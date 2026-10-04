"""Assessment: tasks, attempts, submissions and ADAPT challenges (sections 3.4-A, 5, 12).

Task spec conventions (stored in tasks.spec):
  KNOW   {"questions": [{"id", "text", "options": [...], "answer_index"}]}   answer_index is private
  DO     {"language": "python", "initial_code", "tests": [{name, call, expected, hidden}]}   tests are private
  ADAPT  {"template": "subnet_plan" | "business_rules" | "imbalanced_metrics", "changed": bool}
  PROVE  {"requirements": [...]}   evidence stays pending until a teacher/expert verifies it
  DEFEND conducted through /viva on an evaluated DO/ADAPT attempt
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import STUDENT, client_ip, ensure_can_view, get_current_user
from app.core.database import get_db
from app.models import AIUsageLog, Attempt, Skill, Submission, Task, TaskVariant, User
from app.schemas.assessment import AttemptStart
from app.services import audit, challenges, evaluation, integrity, skill_service
from app.worker.queue import enqueue

router = APIRouter()
challenge_router = APIRouter()

PRIVATE_SPEC_KEYS = {"tests", "answer_key", "reference", "solution"}


def public_spec(task: Task) -> Dict[str, Any]:
    """Strips answer keys and hidden tests before a spec leaves the server."""
    spec = {k: v for k, v in (task.spec or {}).items() if k not in PRIVATE_SPEC_KEYS}
    if task.layer == "KNOW" and "questions" in spec:
        spec["questions"] = [{k: v for k, v in q.items() if k != "answer_index"} for q in spec["questions"]]
    if task.layer == "DO" and (task.spec or {}).get("tests"):
        spec["visible_tests"] = [t["name"] for t in task.spec["tests"] if not t.get("hidden")]
        spec["tests_total"] = len(task.spec["tests"])
    return spec


def task_payload(task: Task) -> Dict[str, Any]:
    return {
        "id": str(task.id),
        "skill_id": str(task.skill_id),
        "layer": task.layer,
        "title": task.title,
        "type": task.type,
        "spec": public_spec(task),
        "ai_mode": task.ai_mode,
        "difficulty": task.difficulty,
        "duration_minutes": task.duration_minutes,
        "reward_points": task.reward_points,
        "status": task.status,
    }


@router.get("")
async def list_tasks(
    layer: Optional[str] = None,
    skill: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Task).where(Task.status == "active", Task.is_deleted.is_(False))
    if layer and layer != "Barchasi":
        query = query.where(Task.layer == layer)
    if skill:
        try:
            query = query.where(Task.skill_id == uuid.UUID(skill))
        except ValueError:
            query = query.join(Skill, Skill.id == Task.skill_id).where(Skill.code == skill)
    tasks = (await db.execute(query)).scalars().all()
    return [task_payload(t) for t in tasks]


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------

async def _get_task(db: AsyncSession, task_id) -> Task:
    task = (await db.execute(select(Task).where(Task.id == task_id, Task.is_deleted.is_(False)))).scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    return task


async def _issue_variant(db: AsyncSession, task: Task, user: User, attempt_no: int) -> TaskVariant:
    """Creates a unique, pre-solved ADAPT variant for this student and attempt."""
    template = (task.spec or {}).get("template")
    if template not in challenges.TEMPLATES:
        raise HTTPException(status_code=500, detail="ADAPT topshirig‘ida challenge shabloni ko‘rsatilmagan")
    changed = bool((task.spec or {}).get("changed"))
    for nonce in range(5):
        variant = challenges.generate(template, challenges.derive_seed(user.id, task.id, attempt_no, nonce), changed)
        clash = (
            await db.execute(select(TaskVariant.id).where(TaskVariant.task_id == task.id, TaskVariant.checksum == variant.checksum))
        ).first()
        if not clash:
            break
    row = TaskVariant(
        task_id=task.id,
        user_id=user.id,
        seed=variant.seed,
        params={"template": template, "kind": variant.kind, "statement": variant.statement,
                "public": variant.public, "private": variant.private},
        solution_ref=f"reference:{template}",
        checksum=variant.checksum,
    )
    db.add(row)
    await db.flush()
    return row


def variant_payload(v: TaskVariant) -> Dict[str, Any]:
    p = v.params or {}
    return {"variant_id": str(v.id), "template": p.get("template"), "kind": p.get("kind"),
            "statement": p.get("statement"), "params": p.get("public")}


async def _start(db: AsyncSession, request: Request, user: User, task_id, ai_mode: Optional[str]) -> Dict[str, Any]:
    if user.role != STUDENT:
        raise HTTPException(status_code=403, detail="Topshiriqni faqat talaba topshira oladi.")
    task = await _get_task(db, task_id)
    # The teacher/expert sets the AI mode per task (section 5.2); students can't switch it
    attempt_no = (
        await db.execute(select(func.count(Attempt.id)).where(Attempt.user_id == user.id, Attempt.task_id == task.id))
    ).scalar() + 1
    variant = await _issue_variant(db, task, user, attempt_no) if task.layer == "ADAPT" else None
    attempt = Attempt(
        user_id=user.id,
        task_id=task.id,
        variant_id=variant.id if variant else None,
        ai_mode=task.ai_mode,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    audit.record(db, actor_id=user.id, action="attempt.start", entity="task", entity_id=task.id, ip=client_ip(request))
    await db.commit()
    await db.refresh(attempt)
    return {
        "attempt_id": str(attempt.id),
        "task_id": str(task.id),
        "title": task.title,
        "layer": task.layer,
        "ai_mode": attempt.ai_mode,
        "duration_minutes": task.duration_minutes,
        "spec": public_spec(task),
        "variant": variant_payload(variant) if variant else None,
        "started_at": attempt.started_at.isoformat(),
    }


@router.post("/attempts")
async def start_attempt(payload: AttemptStart, request: Request, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    return await _start(db, request, user, payload.task_id, payload.ai_mode)


class SubmitPayload(BaseModel):
    code_content: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    repo_url: Optional[str] = None
    ai_prompts_count: Optional[int] = 0
    ai_accepted_ratio: Optional[float] = None
    self_declared_contribution: Optional[float] = None  # 0..1, student's own share of the work
    telemetry: Optional[Dict[str, Any]] = None  # paste_events, max_paste_chars, tab_switches (AI-free)


async def _load_attempt(db: AsyncSession, attempt_id, user: User) -> Attempt:
    attempt = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Urinish topilmadi")
    await ensure_can_view(db, user, attempt.user_id)
    return attempt


def _grade_know(task: Task, answers: Dict[str, Any]):
    questions = (task.spec or {}).get("questions") or []
    if not questions:
        raise HTTPException(status_code=500, detail="KNOW topshirig‘ida savollar yo‘q")
    details = []
    for q in questions:
        given = (answers or {}).get(str(q["id"]))
        ok = given is not None and int(given) == int(q["answer_index"])
        details.append({"name": str(q["id"]), "passed": ok, "error": None if ok else "noto‘g‘ri"})
    return round(100 * sum(d["passed"] for d in details) / len(details), 1), details


async def _submit(db: AsyncSession, request: Request, user: User, attempt_id, payload: SubmitPayload) -> Dict[str, Any]:
    attempt = await _load_attempt(db, attempt_id, user)
    if attempt.user_id != user.id:
        raise HTTPException(status_code=403, detail="Faqat o‘z urinishingizni topshira olasiz.")
    if attempt.status not in ("in_progress", "awaiting_sandbox"):
        if attempt.status == "queued":
            raise HTTPException(status_code=409, detail="Yechim allaqachon navbatda tekshirilmoqda.")
        raise HTTPException(status_code=400, detail="Bu urinish allaqachon topshirilgan.")
    task = await _get_task(db, attempt.task_id)
    now = datetime.now(timezone.utc)
    attempt.submitted_at = now
    attempt.duration_seconds = int((now - attempt.started_at).total_seconds())

    existing_sub = (await db.execute(select(Submission).where(Submission.attempt_id == attempt.id))).scalars().first()
    submission = existing_sub or Submission(attempt_id=attempt.id)
    submission.code_content = payload.code_content
    submission.answers = payload.answers or {}
    submission.repo_url = payload.repo_url
    if not existing_sub:
        db.add(submission)

    # The assistant log is written server-side by /assistant; the student adds their own-contribution declaration
    usage = (await db.execute(select(AIUsageLog).where(AIUsageLog.attempt_id == attempt.id, AIUsageLog.tool == "assistant"))).scalars().first()
    if usage and payload.self_declared_contribution is not None:
        usage.self_declared_contribution = max(0.0, min(1.0, payload.self_declared_contribution))
    elif not usage and (payload.ai_prompts_count or payload.self_declared_contribution is not None):
        # AI used outside the platform (declared by the student)
        db.add(AIUsageLog(
            attempt_id=attempt.id,
            tool="external (declared)",
            prompts_ref=[{"count": payload.ai_prompts_count or 0}],
            accepted_ratio=payload.ai_accepted_ratio or 0.0,
            self_declared_contribution=payload.self_declared_contribution if payload.self_declared_contribution is not None else 1.0,
        ))

    score: Optional[float] = None
    details: list = []
    grader = "checker"
    evidence_status = "verified"
    message = ""
    variant = None
    if attempt.variant_id:
        variant = (await db.execute(select(TaskVariant).where(TaskVariant.id == attempt.variant_id))).scalars().first()

    if task.layer == "KNOW":
        score, details = _grade_know(task, payload.answers or {})
    elif task.layer in ("DO", "ADAPT") and (task.layer == "DO" or (variant and variant.params.get("kind") == "code")):
        if not payload.code_content:
            raise HTTPException(status_code=400, detail="Kod yuborilmadi.")
        # Code runs in the sandbox worker (section 3.4-A); the client polls /attempts/{id}/result
        attempt.status = "queued"
        submission.test_results = {"status": "queued", "telemetry": payload.telemetry}
        audit.record(db, actor_id=user.id, action="attempt.submit", entity="attempt", entity_id=attempt.id,
                     after={"layer": task.layer, "status": "queued"}, ip=client_ip(request))
        await db.commit()
        await enqueue("evaluate_code", str(attempt.id))
        return {
            "attempt_id": str(attempt.id), "status": "queued", "total_score": None, "details": [],
            "message": "Yechim navbatga qo‘yildi: avtotestlar izolyatsiyalangan sandbox’da bajarilmoqda.",
            "flags": [], "skill": None,
        }
    elif task.layer == "ADAPT":
        p = variant.params
        score, details = challenges.check_answer(p["template"], p["public"], p["private"], payload.answers or {})
    elif task.layer == "PROVE":
        if not payload.repo_url:
            raise HTTPException(status_code=400, detail="Loyiha havolasi (repo_url) kerak.")
        # Real-world evidence counts only after a teacher/expert/employer verifies it (section 5.6)
        evidence_status = "pending"
        message = "Loyiha tasdiqlovchiga yuborildi; tasdiqlangach Skill DNA’ga qo‘shiladi."
    else:
        raise HTTPException(status_code=400, detail="DEFEND qatlami AI Viva orqali topshiriladi.")

    if score is not None or evidence_status == "pending":
        await evaluation.record_result(db, attempt=attempt, task=task, score=score, details=details, grader=grader,
                                       evidence_status=evidence_status, source_ref=payload.repo_url)

    flags = await integrity.check_submission(
        db, attempt=attempt, skill_id=task.skill_id, task_layer=task.layer, expected_minutes=task.duration_minutes,
        code=payload.code_content, answers=payload.answers, telemetry=payload.telemetry,
    )
    await db.flush()
    result = await skill_service.recompute(db, attempt.user_id, task.skill_id) if score is not None else None

    audit.record(db, actor_id=user.id, action="attempt.submit", entity="attempt", entity_id=attempt.id,
                 after={"layer": task.layer, "score": score, "status": attempt.status}, ip=client_ip(request))
    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "status": attempt.status,
        "total_score": score,
        "details": details,
        "message": message,
        "flags": [f.type for f in flags],
        "skill": {
            "score": result.score, "confidence": result.confidence, "level": result.level,
            "layers": result.layer_scores, "level_blockers": result.level_blockers,
        } if result else None,
        # Legacy fields the current student UI reads
        "scores": {"details": details},
        "rationale": message or (f"{sum(1 for d in details if d.get('passed'))}/{len(details)} mezon bajarildi." if details else ""),
        "earned_points": task.reward_points if score is not None else 0,
        "new_skill_score": result.score if result else None,
        "new_confidence": result.confidence if result else None,
    }


@router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: uuid.UUID, payload: SubmitPayload, request: Request,
                         user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _submit(db, request, user, attempt_id, payload)


@router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    attempt = await _load_attempt(db, attempt_id, user)
    task = await _get_task(db, attempt.task_id)
    variant = None
    if attempt.variant_id:
        variant = (await db.execute(select(TaskVariant).where(TaskVariant.id == attempt.variant_id))).scalars().first()
    return {
        "attempt_id": str(attempt.id),
        "task": task_payload(task),
        "status": attempt.status,
        "ai_mode": attempt.ai_mode,
        "started_at": attempt.started_at.isoformat(),
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "variant": variant_payload(variant) if variant else None,
    }


@router.get("/attempts/{attempt_id}/result")
async def get_attempt_result(attempt_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Polled by the client while a submission is queued; same shape as the instant submit response."""
    attempt = await _load_attempt(db, attempt_id, user)
    return await evaluation.result_payload(db, attempt)


# Legacy paths used by the current student UI
@router.post("/attempt/start")
async def legacy_start(payload: AttemptStart, request: Request, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    return await _start(db, request, user, payload.task_id, payload.ai_mode)


class LegacySubmit(SubmitPayload):
    attempt_id: uuid.UUID


@router.post("/attempt/submit")
async def legacy_submit(payload: LegacySubmit, request: Request, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    return await _submit(db, request, user, payload.attempt_id, payload)


# ---------------------------------------------------------------------------
# Challenges (section 12 "Challenge")
# ---------------------------------------------------------------------------

class ChallengeRequest(BaseModel):
    task_id: uuid.UUID


@challenge_router.post("/challenges/request")
async def request_challenge(payload: ChallengeRequest, request: Request, user: User = Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, payload.task_id)
    if task.layer != "ADAPT":
        raise HTTPException(status_code=400, detail="Challenge faqat ADAPT topshiriqlari uchun.")
    return await _start(db, request, user, task.id, None)


@challenge_router.get("/challenges/{variant_id}")
async def get_challenge(variant_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    v = (await db.execute(select(TaskVariant).where(TaskVariant.id == variant_id))).scalars().first()
    if not v:
        raise HTTPException(status_code=404, detail="Variant topilmadi")
    await ensure_can_view(db, user, v.user_id)
    return variant_payload(v)
