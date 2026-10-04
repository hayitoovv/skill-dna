"""Turning a graded attempt into evaluation + evidence + recomputed score (section 3.4-A).

Shared by the API (instant checks: KNOW, answer-checked ADAPT) and the background worker (sandbox
runs), so both paths record results identically.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Attempt, Evaluation, Evidence, EvidenceEdge, IntegrityFlag, Submission, Task, TaskVariant
from app.services import audit, integrity, sandbox, skill_service


def summary(details: List[Dict[str, Any]]) -> str:
    return f"{sum(1 for d in details if d.get('passed'))}/{len(details)} mezon bajarildi." if details else ""


async def record_result(
    db: AsyncSession,
    *,
    attempt: Attempt,
    task: Task,
    score: Optional[float],
    details: List[Dict[str, Any]],
    grader: str,
    evidence_status: str = "verified",
    source_ref: Optional[str] = None,
) -> Optional[Evidence]:
    """Writes the evaluation and evidence node; links ADAPT evidence to the practical work it adapts."""
    attempt.status = "evaluated" if score is not None else "submitted"
    if score is not None:
        db.add(Evaluation(attempt_id=attempt.id, grader=grader, scores={"details": details}, total_score=score,
                          rationale=summary(details), model_ref="deterministic"))
    evidence = Evidence(
        user_id=attempt.user_id, skill_id=task.skill_id, attempt_id=attempt.id, layer=task.layer,
        title=f"{task.layer}: {task.title}", source_ref=source_ref or f"attempt:{attempt.id}",
        score=score if score is not None else 0.0, verified_by=grader if score is not None else None,
        status=evidence_status,
    )
    db.add(evidence)
    await db.flush()
    if task.layer == "ADAPT":
        do_ev = (
            await db.execute(
                select(Evidence).where(Evidence.user_id == attempt.user_id, Evidence.skill_id == task.skill_id,
                                       Evidence.layer == "DO", Evidence.status == "verified", Evidence.id != evidence.id)
                .order_by(Evidence.created_at.desc()).limit(1)
            )
        ).scalars().first()
        if do_ev:
            db.add(EvidenceEdge(from_id=evidence.id, to_id=do_ev.id, type="derived_from"))
    return evidence


def code_tests(task: Task, variant: Optional[TaskVariant]) -> List[Dict[str, Any]]:
    if task.layer == "DO":
        return (task.spec or {}).get("tests") or []
    return ((variant.params or {}).get("private") or {}).get("tests") or [] if variant else []


async def evaluate_code(db: AsyncSession, attempt_id: uuid.UUID) -> Dict[str, Any]:
    """Background job body: run the sandbox for a queued code attempt and record the outcome."""
    attempt = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalars().first()
    if not attempt or attempt.status != "queued":
        return {"skipped": True}
    task = (await db.execute(select(Task).where(Task.id == attempt.task_id))).scalars().first()
    variant = None
    if attempt.variant_id:
        variant = (await db.execute(select(TaskVariant).where(TaskVariant.id == attempt.variant_id))).scalars().first()
    submission = (await db.execute(select(Submission).where(Submission.attempt_id == attempt.id))).scalars().first()
    telemetry = ((submission.test_results or {}).get("telemetry")) if submission else None

    report = await sandbox.run_python(submission.code_content or "", code_tests(task, variant))
    submission.test_results = {**report.as_dict(), "telemetry": telemetry}
    score = None
    if report.status != "ok":
        attempt.status = "awaiting_sandbox"
    else:
        score = report.score
        await record_result(db, attempt=attempt, task=task, score=score, details=report.results, grader="auto_sandbox")

    await integrity.check_submission(
        db, attempt=attempt, skill_id=task.skill_id, task_layer=task.layer, expected_minutes=task.duration_minutes,
        code=submission.code_content, answers=submission.answers, telemetry=telemetry,
    )
    await db.flush()
    if score is not None:
        await skill_service.recompute(db, attempt.user_id, task.skill_id)
    audit.record(db, actor_id=None, action="attempt.evaluated", entity="attempt", entity_id=attempt.id,
                 after={"score": score, "status": attempt.status, "worker": True})
    await db.commit()
    return {"attempt_id": str(attempt.id), "status": attempt.status, "score": score}


async def result_payload(db: AsyncSession, attempt: Attempt) -> Dict[str, Any]:
    """Status, test details, flags and the current skill standing for an attempt (used for polling)."""
    task = (await db.execute(select(Task).where(Task.id == attempt.task_id))).scalars().first()
    evals = (await db.execute(select(Evaluation).where(Evaluation.attempt_id == attempt.id))).scalars().all()
    sub = (await db.execute(select(Submission).where(Submission.attempt_id == attempt.id))).scalars().first()
    flags = (await db.execute(select(IntegrityFlag).where(IntegrityFlag.attempt_id == attempt.id))).scalars().all()
    primary = next((e for e in evals if e.grader in ("auto_sandbox", "checker")), None)
    details = (primary.scores or {}).get("details", []) if primary else []
    score = (await skill_service.latest_scores(db, [attempt.user_id])).get((attempt.user_id, task.skill_id))
    test_results = dict(sub.test_results or {}) if sub else {}
    test_results.pop("telemetry", None)
    return {
        "attempt_id": str(attempt.id),
        "status": attempt.status,
        "total_score": primary.total_score if primary else None,
        "details": details,
        "message": test_results.get("message") or "",
        "flags": [f.type for f in flags],
        "test_results": test_results or None,
        "skill": {"score": score.score, "confidence": score.confidence, "level": score.level,
                  "layers": skill_service.layer_view(score),
                  "level_blockers": skill_service.meta_view(score).get("level_blockers", [])} if score and primary else None,
        "evaluations": [
            {"grader": e.grader, "total_score": e.total_score, "scores": e.scores, "rationale": e.rationale,
             "model_ref": e.model_ref, "spans": e.spans}
            for e in evals
        ],
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
