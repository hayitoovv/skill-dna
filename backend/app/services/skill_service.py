"""Derives skill scores from evidence (section 4: evidence is the source of truth).

skill_scores keeps history: every recompute appends a row stamped with formula_version, and
readers take the latest row per skill.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Credential, Evidence, SkillScore
from app.services import integrity, scoring_engine
from app.services.scoring_engine import EvidenceItem, ScoreResult

AUTO_VERIFIERS = {"automated", "auto", "auto_sandbox", "llm", "checker"}


def is_human_verified(e: Evidence) -> bool:
    return bool(e.verified_by) and e.verified_by not in AUTO_VERIFIERS and e.status == "verified"


async def evidence_for(db: AsyncSession, user_id: uuid.UUID, skill_id: uuid.UUID) -> List[Evidence]:
    rows = (
        await db.execute(
            select(Evidence).where(
                Evidence.user_id == user_id,
                Evidence.skill_id == skill_id,
                Evidence.is_deleted.is_(False),
                # Pending evidence (e.g. PROVE awaiting a verifier) does not count until verified
                Evidence.status == "verified",
            )
        )
    ).scalars().all()
    return list(rows)


async def recompute(db: AsyncSession, user_id: uuid.UUID, skill_id: uuid.UUID) -> ScoreResult:
    """Recomputes score/confidence/level for one skill, raises CROSS_LAYER_GAP if needed, appends history."""
    evidence = await evidence_for(db, user_id, skill_id)
    items = [
        EvidenceItem(layer=e.layer, score=float(e.score), created_at=e.created_at, human_verified=is_human_verified(e))
        for e in evidence
    ]

    # First pass to know the layer scores, so the cross-layer signal can be evaluated
    preliminary = scoring_engine.compute(items)
    gap = integrity.cross_layer_gap(preliminary.layer_scores)
    if gap is not None:
        await integrity.raise_flag(
            db, user_id=user_id, flag_type=integrity.CROSS_LAYER_GAP, severity="high",
            details={"skill_id": str(skill_id), "gap": round(gap, 1), "layers": preliminary.layer_scores},
            dedupe_key=f"{skill_id}",
        )
        await db.flush()

    flags = await integrity.open_flags_for_skill(db, user_id, skill_id)
    cap = min((integrity.LEVEL_HOLDING[f.type] for f in flags if f.type in integrity.LEVEL_HOLDING), default=None)
    viva_flagged = any(f.type in integrity.VIVA_BLOCKING for f in flags)
    teach_back = any((e.source_ref or "").startswith("teach_back") and e.status == "verified" for e in evidence)

    result = scoring_engine.compute(items, viva_flagged=viva_flagged, has_teach_back=teach_back, cap_code=cap)

    db.add(
        SkillScore(
            user_id=user_id,
            skill_id=skill_id,
            score=result.score,
            confidence=result.confidence,
            level=result.level,
            components={
                **result.layer_scores,
                "_meta": {
                    "confidence_parts": result.confidence_parts,
                    "level_blockers": result.level_blockers,
                    "evidence_count": len(items),
                    "open_flags": [f.type for f in flags],
                },
            },
            computed_at=datetime.now(timezone.utc),
            formula_version=result.formula_version,
        )
    )

    # Section 3.4-C: a credential is revoked when later evidence drops the skill below its level
    issued = (
        await db.execute(
            select(Credential).where(Credential.user_id == user_id, Credential.skill_id == skill_id, Credential.status == "issued")
        )
    ).scalars().all()
    for cred in issued:
        if cred.level[:2] > result.level_code:
            cred.status = "revoked"
            cred.revoked_at = datetime.now(timezone.utc)
    return result


async def latest_scores(db: AsyncSession, user_ids: Optional[List[uuid.UUID]] = None) -> Dict[tuple, SkillScore]:
    """Latest SkillScore per (user_id, skill_id)."""
    latest = select(
        SkillScore.user_id, SkillScore.skill_id, func.max(SkillScore.computed_at).label("ts")
    ).group_by(SkillScore.user_id, SkillScore.skill_id)
    if user_ids is not None:
        latest = latest.where(SkillScore.user_id.in_(user_ids))
    latest = latest.subquery()
    rows = (
        await db.execute(
            select(SkillScore).join(
                latest,
                and_(
                    SkillScore.user_id == latest.c.user_id,
                    SkillScore.skill_id == latest.c.skill_id,
                    SkillScore.computed_at == latest.c.ts,
                ),
            )
        )
    ).scalars().all()
    return {(s.user_id, s.skill_id): s for s in rows}


def layer_view(score: Optional[SkillScore]) -> Dict[str, Optional[float]]:
    comps = (score.components or {}) if score else {}
    return {l: comps.get(l) for l in scoring_engine.LAYERS}


def meta_view(score: Optional[SkillScore]) -> dict:
    return ((score.components or {}).get("_meta") or {}) if score else {}
