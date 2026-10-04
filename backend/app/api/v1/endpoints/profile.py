"""Skill DNA profile, per-skill score explanation and Evidence Graph (sections 6, 8, 11, 12 "Profil va ball")."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_can_view, get_current_user
from app.core.database import get_db
from app.models import Direction, Evidence, EvidenceEdge, Skill, StudentProfile, User
from app.services import skill_service
from app.services.scoring_engine import LAYERS

router = APIRouter()
skills_router = APIRouter()


async def _target_user(db: AsyncSession, viewer: User, user_id: Optional[str]) -> User:
    """Viewers see their own profile; staff may look at a student's profile by id."""
    if not user_id or user_id == str(viewer.id):
        return viewer
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri user_id")
    await ensure_can_view(db, viewer, uid)
    target = (await db.execute(select(User).where(User.id == uid))).scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return target


def _skill_row(sk: Skill, score, evidence_count: int) -> dict:
    meta = skill_service.meta_view(score)
    return {
        "id": str(sk.id),
        "code": sk.code,
        "name": sk.name,
        "type": sk.type,
        "isCore": sk.type == "core",
        "pilot": bool((sk.framework_refs or {}).get("pilot")),
        "score": round(score.score) if score else 0,
        "confidence": round(score.confidence) if score else 0,
        "level": score.level if score else "L0",
        "layers": skill_service.layer_view(score),
        "level_blockers": meta.get("level_blockers", []),
        "open_flags": meta.get("open_flags", []),
        "evidenceCount": evidence_count,
        "computed_at": score.computed_at.isoformat() if score else None,
        "formula_version": score.formula_version if score else None,
    }


@router.get("/skill-dna")
@router.get("/dna")
async def skill_dna(user_id: Optional[str] = None, viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await _target_user(db, viewer, user_id)
    profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))).scalars().first()
    direction = None
    if profile and profile.direction_id:
        direction = (await db.execute(select(Direction).where(Direction.id == profile.direction_id))).scalars().first()

    skills_q = select(Skill).where(Skill.is_deleted.is_(False))
    if direction:
        # Direction skills plus the cross-cutting ones (section 9.4)
        skills_q = skills_q.where(or_(Skill.direction_id == direction.id, Skill.type == "cross"))
    skills = (await db.execute(skills_q)).scalars().all()

    scores = await skill_service.latest_scores(db, [user.id])
    evidence = (await db.execute(select(Evidence).where(Evidence.user_id == user.id, Evidence.status == "verified"))).scalars().all()
    counts = {}
    for e in evidence:
        counts[e.skill_id] = counts.get(e.skill_id, 0) + 1

    rows = [_skill_row(sk, scores.get((user.id, sk.id)), counts.get(sk.id, 0)) for sk in skills]
    # Primary skill = highest level, then score (a high score without the required layers is still L0)
    rows.sort(key=lambda r: (r["level"].split(" ")[0], r["score"]), reverse=True)
    primary = rows[0] if rows and rows[0]["score"] else None

    return {
        "direction": {"id": str(direction.id), "code": direction.code, "name": direction.name} if direction else None,
        "student": {"id": str(user.id), "name": user.full_name,
                    "course": profile.course if profile else None, "group": profile.group_id if profile else None},
        "overall_score": primary["score"] if primary else 0,
        "confidence": primary["confidence"] if primary else 0,
        "level": primary["level"] if primary else "L0",
        "primary_skill": primary,
        "evidence_count": len(evidence),
        "layers": primary["layers"] if primary else {l: None for l in LAYERS},
        "skills": rows,
    }


@skills_router.get("/skills/{skill_id}/score")
async def skill_score_detail(skill_id: uuid.UUID, user_id: Optional[str] = None, viewer: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    """The "nega?" button: score, confidence parts, level blockers and the evidence behind them."""
    user = await _target_user(db, viewer, user_id)
    skill = (await db.execute(select(Skill).where(Skill.id == skill_id))).scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")
    score = (await skill_service.latest_scores(db, [user.id])).get((user.id, skill_id))
    evidence = await skill_service.evidence_for(db, user.id, skill_id)
    meta = skill_service.meta_view(score)
    return {
        "skill": {"id": str(skill.id), "code": skill.code, "name": skill.name},
        "score": score.score if score else 0,
        "confidence": score.confidence if score else 0,
        "level": score.level if score else "L0",
        "layers": skill_service.layer_view(score),
        "confidence_parts": meta.get("confidence_parts", {}),
        "level_blockers": meta.get("level_blockers", []),
        "open_flags": meta.get("open_flags", []),
        "formula_version": score.formula_version if score else None,
        "evidence": [
            {"id": str(e.id), "layer": e.layer, "title": e.title, "score": e.score,
             "verified_by": e.verified_by, "human_verified": skill_service.is_human_verified(e),
             "created_at": e.created_at.isoformat()}
            for e in sorted(evidence, key=lambda e: e.created_at, reverse=True)
        ],
    }


async def _graph(db: AsyncSession, user: User, skill_id: Optional[uuid.UUID]) -> dict:
    q = select(Evidence).where(Evidence.user_id == user.id, Evidence.is_deleted.is_(False))
    if skill_id:
        q = q.where(Evidence.skill_id == skill_id)
    evidence = (await db.execute(q)).scalars().all()
    ids = [e.id for e in evidence]
    edges = (await db.execute(select(EvidenceEdge).where(or_(EvidenceEdge.from_id.in_(ids), EvidenceEdge.to_id.in_(ids))))).scalars().all() if ids else []
    skills = {s.id: s for s in (await db.execute(select(Skill).where(Skill.id.in_({e.skill_id for e in evidence})))).scalars().all()} if evidence else {}
    scores = await skill_service.latest_scores(db, [user.id])

    nodes = [
        {"id": str(e.id), "label": e.title, "type": e.layer.lower(), "layer": e.layer, "status": e.status,
         "score": e.score, "verified_by": e.verified_by, "created_at": e.created_at.isoformat()}
        for e in evidence
    ]
    out_edges = [{"source": str(ed.from_id), "target": str(ed.to_id), "type": ed.type} for ed in edges]
    # Each verified evidence supports its skill's score node
    for sid, sk in skills.items():
        sc = scores.get((user.id, sid))
        node_id = f"skill:{sid}"
        nodes.append({"id": node_id, "label": f"{sk.name}: {round(sc.score) if sc else 0}/100 (Confidence {round(sc.confidence) if sc else 0}%)",
                      "type": "score", "status": sc.level if sc else "L0", "score": sc.score if sc else 0})
        out_edges += [{"source": str(e.id), "target": node_id, "type": "supports"}
                      for e in evidence if e.skill_id == sid and e.status == "verified"]
    return {"nodes": nodes, "edges": out_edges}


@router.get("/evidence-graph")
async def evidence_graph(user_id: Optional[str] = None, skill_id: Optional[uuid.UUID] = None,
                         viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _graph(db, await _target_user(db, viewer, user_id), skill_id)


@skills_router.get("/skills/{skill_id}/evidence-graph")
async def skill_evidence_graph(skill_id: uuid.UUID, user_id: Optional[str] = None,
                               viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _graph(db, await _target_user(db, viewer, user_id), skill_id)
