"""Integrity signals (section 7, table 7.1).

No AI detector is used, and no signal penalises a student automatically: a flag only routes the
case to a moderator, may request extra evidence, or temporarily holds a high level. Students can
always appeal.
"""
import difflib
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Attempt, IntegrityFlag, Submission
from app.services import llm

CROSS_LAYER_GAP = "CROSS_LAYER_GAP"
VIVA_DISAGREEMENT = "VIVA_DISAGREEMENT"
SIMILARITY_HIGH = "SIMILARITY_HIGH"
PASTE_BURST = "PASTE_BURST"
TAB_ANOMALY = "TAB_ANOMALY"
VOLUME_ANOMALY = "VOLUME_ANOMALY"
PROMPT_INJECTION = "PROMPT_INJECTION"

# Initial thresholds from table 7.1 (calibrated in the pilot)
CROSS_LAYER_GAP_POINTS = 35
SIMILARITY_RATIO = 0.92
SIMILARITY_MIN_CHARS = 80
PASTE_BURST_CHARS = 300
PASTE_BURST_EVENTS = 3
TAB_SWITCH_LIMIT = 8
VOLUME_PER_HOUR = 12
VOLUME_MIN_DURATION_SHARE = 0.15

# Flags that hold the level while open (section 7.1 "yuqori daraja to‘xtatiladi"; 6.4 "Viva bayroqsiz")
LEVEL_HOLDING = {CROSS_LAYER_GAP: "L3"}
VIVA_BLOCKING = {VIVA_DISAGREEMENT}

OPEN_STATUSES = ("pending", "under_review")


async def raise_flag(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    flag_type: str,
    severity: str,
    details: Dict[str, Any],
    attempt_id: Optional[uuid.UUID] = None,
    dedupe_key: Optional[str] = None,
) -> Optional[IntegrityFlag]:
    """Creates a flag unless an open one with the same type and dedupe key already exists."""
    key = dedupe_key or (str(attempt_id) if attempt_id else None)
    if key:
        existing = (
            await db.execute(
                select(IntegrityFlag).where(
                    IntegrityFlag.user_id == user_id,
                    IntegrityFlag.type == flag_type,
                    IntegrityFlag.status.in_(OPEN_STATUSES),
                    IntegrityFlag.details["dedupe_key"].as_string() == key,
                )
            )
        ).scalars().first()
        if existing:
            return None
    flag = IntegrityFlag(
        user_id=user_id,
        attempt_id=attempt_id,
        type=flag_type,
        severity=severity,
        details={**details, "dedupe_key": key},
        status="pending",
    )
    db.add(flag)
    return flag


async def open_flags_for_skill(db: AsyncSession, user_id: uuid.UUID, skill_id: uuid.UUID) -> list:
    rows = (
        await db.execute(
            select(IntegrityFlag).where(
                IntegrityFlag.user_id == user_id,
                IntegrityFlag.status.in_(OPEN_STATUSES),
                IntegrityFlag.details["skill_id"].as_string() == str(skill_id),
            )
        )
    ).scalars().all()
    return list(rows)


def cross_layer_gap(layer_scores: Dict[str, float]) -> Optional[float]:
    do, defend = layer_scores.get("DO"), layer_scores.get("DEFEND")
    if do is None or defend is None:
        return None
    gap = abs(do - defend)
    return gap if gap >= CROSS_LAYER_GAP_POINTS else None


def _normalise_code(code: str) -> str:
    code = re.sub(r"#.*", "", code or "")
    code = re.sub(r'""".*?"""|\'\'\'.*?\'\'\'', "", code, flags=re.S)
    return re.sub(r"\s+", " ", code).strip()


async def check_submission(
    db: AsyncSession,
    *,
    attempt: Attempt,
    skill_id: uuid.UUID,
    task_layer: str,
    expected_minutes: int,
    code: Optional[str],
    answers: Optional[Dict[str, Any]],
    telemetry: Optional[Dict[str, Any]],
) -> list:
    """Runs the per-submission signals; returns the flags raised (already added to the session)."""
    raised = []
    base = {"skill_id": str(skill_id), "layer": task_layer}

    # SIMILARITY_HIGH: structural similarity with other students' submissions for the same task
    norm = _normalise_code(code or "")
    if len(norm) >= SIMILARITY_MIN_CHARS:
        others = (
            await db.execute(
                select(Submission.code_content, Attempt.user_id)
                .join(Attempt, Attempt.id == Submission.attempt_id)
                .where(Attempt.task_id == attempt.task_id, Attempt.user_id != attempt.user_id)
                .limit(200)
            )
        ).all()
        best, best_user = 0.0, None
        for other_code, other_user in others:
            other_norm = _normalise_code(other_code or "")
            if len(other_norm) < SIMILARITY_MIN_CHARS:
                continue
            ratio = difflib.SequenceMatcher(None, norm, other_norm).ratio()
            if ratio > best:
                best, best_user = ratio, other_user
        if best >= SIMILARITY_RATIO:
            f = await raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=SIMILARITY_HIGH,
                                 severity="high", details={**base, "ratio": round(best, 3), "other_user_id": str(best_user)})
            raised.append(f)

    # PASTE_BURST / TAB_ANOMALY: supporting signals only, and only in AI-free mode
    t = telemetry or {}
    if attempt.ai_mode == "AI-free":
        if int(t.get("max_paste_chars", 0)) >= PASTE_BURST_CHARS or int(t.get("paste_events", 0)) >= PASTE_BURST_EVENTS:
            raised.append(await raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=PASTE_BURST,
                                           severity="low", details={**base, "telemetry": t}))
        if int(t.get("tab_switches", 0)) >= TAB_SWITCH_LIMIT:
            raised.append(await raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=TAB_ANOMALY,
                                           severity="low", details={**base, "telemetry": t}))

    # VOLUME_ANOMALY: unusually many submissions, or implausibly fast work on a practical task
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (
        await db.execute(
            select(func.count(Attempt.id)).where(Attempt.user_id == attempt.user_id, Attempt.submitted_at >= hour_ago)
        )
    ).scalar() or 0
    too_fast = (
        task_layer in ("DO", "ADAPT")
        and expected_minutes
        and attempt.duration_seconds < expected_minutes * 60 * VOLUME_MIN_DURATION_SHARE
    )
    if recent > VOLUME_PER_HOUR or too_fast:
        raised.append(await raise_flag(
            db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=VOLUME_ANOMALY, severity="medium",
            details={**base, "submissions_last_hour": recent, "duration_seconds": attempt.duration_seconds},
        ))

    # PROMPT_INJECTION: attempts to steer the AI grader are flagged, never obeyed (section 13.1)
    text = (code or "") + " " + " ".join(str(v) for v in (answers or {}).values())
    if llm.looks_like_injection(text):
        raised.append(await raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=PROMPT_INJECTION,
                                       severity="medium", details=base))

    return [f for f in raised if f is not None]
