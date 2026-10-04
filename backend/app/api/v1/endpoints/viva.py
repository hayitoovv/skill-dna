"""AI Viva (DEFEND) endpoints — sections 3.4-B, 5.4, 12 "Viva"."""
import copy
import uuid
from datetime import datetime, timezone
from typing import Optional

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip, ensure_can_view, get_current_user
from app.api.v1.endpoints.auth import has_consent
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import decode_claims
from app.models import (
    AIUsageLog, Attempt, Evaluation, Evidence, EvidenceEdge, Rubric, Skill, Submission, Task, TaskVariant, User,
    VivaSession, VivaTurn,
)
from app.services import assistant, audit, integrity, skill_service, viva_engine
from app.worker.queue import enqueue

router = APIRouter()


class SessionCreate(BaseModel):
    attempt_id: uuid.UUID
    language: Optional[str] = "uz"


class MessagePayload(BaseModel):
    content: str


def _turns(session: VivaSession):
    return [
        {"id": str(t.id), "role": t.role, "content": t.content, "ts": t.ts.isoformat()}
        for t in sorted(session.turns, key=lambda t: t.ts)
    ]


async def _load_session(db: AsyncSession, session_id, user: User) -> VivaSession:
    session = (
        await db.execute(select(VivaSession).where(VivaSession.id == session_id).options(selectinload(VivaSession.turns)))
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Viva sessiyasi topilmadi")
    attempt = (await db.execute(select(Attempt).where(Attempt.id == session.attempt_id))).scalars().first()
    await ensure_can_view(db, user, attempt.user_id)
    return session


async def _create(db: AsyncSession, request: Request, user: User, attempt_id, language: str):
    attempt = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalars().first()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Urinish topilmadi")
    task = (await db.execute(select(Task).where(Task.id == attempt.task_id))).scalars().first()
    if task.layer not in ("DO", "ADAPT") or attempt.status != "evaluated":
        raise HTTPException(status_code=400, detail="Viva baholangan DO yoki ADAPT topshirig‘idan keyin ochiladi.")
    if not await has_consent(db, user.id, "viva_record"):
        raise HTTPException(status_code=403, detail="Viva uchun avval ‘viva_record’ roziligini bering (Sozlamalar → Consent).")

    existing = (
        await db.execute(select(VivaSession).where(VivaSession.attempt_id == attempt.id).options(selectinload(VivaSession.turns)))
    ).scalars().first()
    if existing:
        return {"session_id": str(existing.id), "status": "completed" if existing.ended_at else "active",
                "turns": _turns(existing)}

    sub = (await db.execute(select(Submission).where(Submission.attempt_id == attempt.id))).scalars().first()
    usage = (await db.execute(select(AIUsageLog).where(AIUsageLog.attempt_id == attempt.id))).scalars().all()
    statement = (task.spec or {}).get("description", "")
    if attempt.variant_id:
        v = (await db.execute(select(TaskVariant).where(TaskVariant.id == attempt.variant_id))).scalars().first()
        statement = (v.params or {}).get("statement", statement)
    solution = (sub.code_content if sub and sub.code_content else str(sub.answers if sub else ""))
    usage_text = "; ".join(
        f"{u.tool}: {len(u.prompts_ref or [])} so‘rov, qabul qilingan takliflar ulushi {u.accepted_ratio}, "
        f"o‘z hissasi deklaratsiyasi {u.self_declared_contribution}; so‘rovlar: "
        + " | ".join(str(e.get("prompt", e))[:120] for e in (u.prompts_ref or [])[:5])
        for u in usage
    ) or "yo‘q"

    lang = language if language in ("uz", "ru", "en") else "uz"
    plan = await viva_engine.build_plan(task.title, statement, solution, attempt.ai_mode, usage_text, lang)
    state = viva_engine.new_state(plan, lang)
    session = VivaSession(attempt_id=attempt.id, mode="text", language=lang, plan=state,
                          started_at=datetime.now(timezone.utc))
    db.add(session)
    await db.flush()
    first = VivaTurn(session_id=session.id, role="examiner", content=viva_engine.first_question(state),
                     ts=datetime.now(timezone.utc))
    db.add(first)
    audit.record(db, actor_id=user.id, action="viva.start", entity="viva_session", entity_id=session.id, ip=client_ip(request))
    await db.commit()
    return {"session_id": str(session.id), "status": "active", "questions_total": len(plan),
            "turns": [{"id": str(first.id), "role": "examiner", "content": first.content, "ts": first.ts.isoformat()}]}


async def _finish(db: AsyncSession, session: VivaSession, actor: User) -> dict:
    attempt = (await db.execute(select(Attempt).where(Attempt.id == session.attempt_id))).scalars().first()
    task = (await db.execute(select(Task).where(Task.id == attempt.task_id))).scalars().first()
    sub = (await db.execute(select(Submission).where(Submission.attempt_id == attempt.id))).scalars().first()
    rubrics = (await db.execute(select(Rubric).where(Rubric.skill_id == task.skill_id).order_by(Rubric.level))).scalars().all()
    rubric_text = "\n".join(f"{r.level_name}: {r.criteria}" for r in rubrics) or "Rubrika mavjud emas"

    answers = (session.plan or {}).get("answers", [])
    code = sub.code_content if sub and sub.code_content else str(sub.answers if sub else "")
    result = await viva_engine.grade(answers, code, rubric_text)
    session.ended_at = datetime.now(timezone.utc)

    for g in result["graders"]:
        db.add(Evaluation(
            attempt_id=attempt.id, grader="llm" if g["model_ref"] != "heuristic-v1" else "heuristic",
            scores=g["scores"], total_score=round(sum(g["scores"].values()) / max(1, len(g["scores"])), 1),
            rationale=g["rationale"], spans=[{"criterion": k, "quote": q} for k, q in g["quotes"].items()],
            model_ref=g["model_ref"],
        ))
    db.add(Evaluation(attempt_id=attempt.id, grader="viva_panel", scores=result["criteria"], total_score=result["total"],
                      rationale=f"Median {len(result['graders'])} baholovchi; farq {result['spread']} ball.",
                      model_ref="median"))

    viva_ev = Evidence(user_id=attempt.user_id, skill_id=task.skill_id, attempt_id=attempt.id, layer="DEFEND",
                       title=f"DEFEND: AI Viva — {task.title}", source_ref=f"viva:{session.id}",
                       score=result["total"], verified_by="llm", status="verified")
    db.add(viva_ev)
    await db.flush()
    practical = (
        await db.execute(select(Evidence).where(Evidence.attempt_id == attempt.id, Evidence.layer.in_(("DO", "ADAPT"))))
    ).scalars().first()
    if practical:
        db.add(EvidenceEdge(from_id=viva_ev.id, to_id=practical.id, type="derived_from"))

    base = {"skill_id": str(task.skill_id), "viva_session_id": str(session.id), "spread": result["spread"]}
    if result["disagreement"]:
        await integrity.raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=integrity.VIVA_DISAGREEMENT,
                                   severity="medium", details=base, dedupe_key=f"viva:{session.id}")
    if result["injection_attempt"]:
        await integrity.raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type=integrity.PROMPT_INJECTION,
                                   severity="medium", details=base, dedupe_key=f"viva-inj:{session.id}")
    await db.flush()

    # AI Fluency (section 5.2): an AI-assisted attempt where the assistant was used, defended in the viva
    usage = (await db.execute(select(AIUsageLog).where(AIUsageLog.attempt_id == attempt.id, AIUsageLog.tool == "assistant"))).scalars().first()
    if attempt.ai_mode == "AI-assisted" and usage and usage.prompts_ref:
        fluency = assistant.ai_fluency_score(practical.score if practical else None, result["criteria"])
        fluency_skill = (await db.execute(select(Skill).where(Skill.code == "GEN-AIFLUENCY"))).scalars().first()
        if fluency is not None and fluency_skill:
            db.add(Evidence(user_id=attempt.user_id, skill_id=fluency_skill.id, attempt_id=attempt.id, layer="DO",
                            title=f"AI Fluency: {task.title}", source_ref=f"assistant:{usage.id}",
                            score=fluency, verified_by="checker", status="verified"))
            await db.flush()
            await skill_service.recompute(db, attempt.user_id, fluency_skill.id)

    score = await skill_service.recompute(db, attempt.user_id, task.skill_id)
    review_reason = viva_engine.needs_human_review(result, score.level)
    if review_reason and not result["disagreement"] and not result["injection_attempt"]:
        # Sample / high-level review is routed to moderators but does not hold the level
        await integrity.raise_flag(db, user_id=attempt.user_id, attempt_id=attempt.id, flag_type="VIVA_SAMPLE_REVIEW",
                                   severity="low", details={**base, "reason": review_reason},
                                   dedupe_key=f"viva-review:{session.id}")

    audit.record(db, actor_id=actor.id, action="viva.finish", entity="viva_session", entity_id=session.id,
                 after={"total": result["total"], "spread": result["spread"]})
    return {"result": result, "skill": score, "review_reason": review_reason}


@router.post("/sessions")
async def create_session(payload: SessionCreate, request: Request, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    return await _create(db, request, user, payload.attempt_id, payload.language)


async def _message(db: AsyncSession, user: User, session_id, content: str):
    session = await _load_session(db, session_id, user)
    attempt = (await db.execute(select(Attempt).where(Attempt.id == session.attempt_id))).scalars().first()
    if attempt.user_id != user.id:
        raise HTTPException(status_code=403, detail="Faqat o‘z vivangizga javob bera olasiz.")
    if session.ended_at:
        raise HTTPException(status_code=400, detail="Ushbu Viva sessiyasi allaqachon yakunlangan")
    content = (content or "").strip()[:4000]
    if not content:
        raise HTTPException(status_code=400, detail="Javob bo‘sh.")

    # Deep copy: nested lists are mutated, and the JSON column must see a changed value
    state = copy.deepcopy(session.plan or {})
    db.add(VivaTurn(session_id=session.id, role="student", content=content, ts=datetime.now(timezone.utc)))
    reply = viva_engine.next_turn(state, content)
    session.plan = state
    flag_modified(session, "plan")

    if reply is not None:
        db.add(VivaTurn(session_id=session.id, role="examiner", content=reply, ts=datetime.now(timezone.utc)))
        await db.commit()
        return {"is_completed": False, "reply": reply, "question_index": state["index"],
                "questions_total": len(state["questions"]), "score": None, "feedback": None}

    # Dialog finished: the grader panel runs in the worker (section 3.1); the client polls the transcript
    state["grading"] = True
    session.plan = state
    flag_modified(session, "plan")
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await enqueue("grade_viva", str(session.id))
    return {"is_completed": True, "grading": True, "reply": "Javoblaringiz qabul qilindi — baholovchilar paneli baholamoqda...",
            "score": None, "feedback": None}


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: uuid.UUID, payload: MessagePayload, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    return await _message(db, user, session_id, payload.content)


@router.get("/sessions/{session_id}/transcript")
async def transcript(session_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = await _load_session(db, session_id, user)
    evals = (await db.execute(select(Evaluation).where(Evaluation.attempt_id == session.attempt_id,
                                                        Evaluation.grader.in_(("llm", "heuristic", "viva_panel", "human"))))).scalars().all()
    plan = session.plan or {}
    return {
        "session_id": str(session.id),
        "status": "grading" if plan.get("grading") else "completed" if session.ended_at else "active",
        "result": plan.get("result"),
        "turns": _turns(session),
        "evaluations": [{"grader": e.grader, "scores": e.scores, "total_score": e.total_score, "rationale": e.rationale,
                         "spans": e.spans, "model_ref": e.model_ref} for e in evals],
    }


async def grade_finished_session(db: AsyncSession, session_id: uuid.UUID) -> dict:
    """Worker job body: grade a viva whose dialog ended, then post the closing examiner message."""
    session = (await db.execute(select(VivaSession).where(VivaSession.id == session_id))).scalars().first()
    if not session or not (session.plan or {}).get("grading"):
        return {"skipped": True}
    attempt = (await db.execute(select(Attempt).where(Attempt.id == session.attempt_id))).scalars().first()
    student = (await db.execute(select(User).where(User.id == attempt.user_id))).scalars().first()
    outcome = await _finish(db, session, student)
    result, skill = outcome["result"], outcome["skill"]
    closing = (f"Viva yakunlandi. Ball: {result['total']}/100. "
               + ("Natija moderator tomonidan ko‘rib chiqiladi." if outcome["review_reason"] else ""))
    db.add(VivaTurn(session_id=session.id, role="examiner", content=closing, ts=datetime.now(timezone.utc)))
    state = copy.deepcopy(session.plan or {})
    state["grading"] = False
    state["result"] = {"score": result["total"], "criteria": result["criteria"], "review_reason": outcome["review_reason"],
                       "skill": {"score": skill.score, "confidence": skill.confidence, "level": skill.level}}
    session.plan = state
    flag_modified(session, "plan")
    await db.commit()
    return {"session_id": str(session.id), "score": result["total"]}


@router.post("/sessions/{session_id}/finish")
async def finish(session_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = await _load_session(db, session_id, user)
    if session.ended_at:
        raise HTTPException(status_code=400, detail="Sessiya allaqachon yakunlangan")
    if not (session.plan or {}).get("answers"):
        raise HTTPException(status_code=400, detail="Hali birorta javob berilmagan.")
    outcome = await _finish(db, session, user)
    await db.commit()
    return {"score": outcome["result"]["total"], "criteria": outcome["result"]["criteria"],
            "review_reason": outcome["review_reason"]}


# Legacy paths used by the current student UI
@router.post("/session/start")
async def legacy_start(attempt_id: uuid.UUID, request: Request, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    return await _create(db, request, user, attempt_id, "uz")


class LegacyMessage(BaseModel):
    session_id: uuid.UUID
    content: str


@router.post("/message")
async def legacy_message(payload: LegacyMessage, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _message(db, user, payload.session_id, payload.content)



# ---------------------------------------------------------------------------
# WebSocket transport (section 12: WS /viva/sessions/{id}). Same logic as the REST endpoint.
# Browsers can't set an Authorization header on a WebSocket and a token in the URL would end up in
# access logs, so the client authenticates with its first message: {"type": "auth", "token": "..."}.
# ---------------------------------------------------------------------------

WS_AUTH_TIMEOUT = 10


async def _ws_user(token: str):
    claims = decode_claims(token or "", "access")
    if not claims or not claims.get("sub"):
        return None
    try:
        uid = uuid.UUID(claims["sub"])
    except ValueError:
        return None
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == uid, User.is_deleted.is_(False)))).scalars().first()
    return user if user and user.status == "active" else None


@router.websocket("/sessions/{session_id}/ws")
async def viva_socket(websocket: WebSocket, session_id: uuid.UUID):
    await websocket.accept()
    try:
        first = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=WS_AUTH_TIMEOUT))
    except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
        await websocket.close(code=4401)
        return
    user = await _ws_user(first.get("token", "")) if first.get("type") == "auth" else None
    if not user:
        await websocket.send_json({"type": "error", "detail": "Avtorizatsiyadan o‘tilmagan"})
        await websocket.close(code=4401)
        return
    async with AsyncSessionLocal() as db:
        try:
            await _load_session(db, session_id, user)
        except HTTPException as e:
            await websocket.send_json({"type": "error", "detail": e.detail, "status": e.status_code})
            await websocket.close(code=4404 if e.status_code == 404 else 4403)
            return
    await websocket.send_json({"type": "ready"})

    try:
        while True:
            try:
                msg = json.loads(await websocket.receive_text())
            except ValueError:
                await websocket.send_json({"type": "error", "detail": "Noto‘g‘ri xabar"})
                continue
            if msg.get("type") != "answer":
                continue
            await websocket.send_json({"type": "thinking"})
            async with AsyncSessionLocal() as db:
                try:
                    out = await _message(db, user, session_id, str(msg.get("content", "")))
                except HTTPException as e:
                    await websocket.send_json({"type": "error", "detail": e.detail, "status": e.status_code})
                    continue
            await websocket.send_json({"type": "completed" if out.get("is_completed") else "examiner", **out})
            if out.get("is_completed"):
                await websocket.close()
                return
    except WebSocketDisconnect:
        return
