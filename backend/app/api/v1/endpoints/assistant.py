"""AI assistant endpoints for AI-assisted attempts (section 5.2, section 12 "AI yordamchi")."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import AIUsageLog, Attempt, Task, User
from app.services import assistant

router = APIRouter()


class AskPayload(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    code: str = Field(default="", max_length=20000)


class DecisionPayload(BaseModel):
    suggestion_id: str
    accepted: bool


async def _context(db: AsyncSession, attempt_id: uuid.UUID, user: User):
    attempt = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalars().first()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Urinish topilmadi")
    task = (await db.execute(select(Task).where(Task.id == attempt.task_id))).scalars().first()
    if attempt.ai_mode != "AI-assisted":
        raise HTTPException(status_code=403, detail="Bu topshiriq AI-free rejimda: AI yordamchi o‘chirilgan.")
    log = (
        await db.execute(select(AIUsageLog).where(AIUsageLog.attempt_id == attempt.id, AIUsageLog.tool == "assistant"))
    ).scalars().first()
    if not log:
        log = AIUsageLog(attempt_id=attempt.id, tool="assistant", prompts_ref=[], accepted_ratio=0.0,
                         self_declared_contribution=1.0)
        db.add(log)
        await db.flush()
    return attempt, task, log


@router.get("/{attempt_id}")
async def assistant_state(attempt_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    attempt, task, log = await _context(db, attempt_id, user)
    await db.commit()
    return {"mode": assistant.mode_for(task.spec), "turns_used": len(log.prompts_ref or []),
            "turns_limit": assistant.MAX_TURNS_PER_ATTEMPT}


@router.post("/{attempt_id}/messages")
async def ask(attempt_id: uuid.UUID, payload: AskPayload, user: User = Depends(get_current_user),
              db: AsyncSession = Depends(get_db)):
    attempt, task, log = await _context(db, attempt_id, user)
    if attempt.status not in ("in_progress", "awaiting_sandbox"):
        raise HTTPException(status_code=400, detail="Urinish topshirilgan; yordamchi yopiq.")
    entries = list(log.prompts_ref or [])
    if len(entries) >= assistant.MAX_TURNS_PER_ATTEMPT:
        raise HTTPException(status_code=429, detail="Bu urinish uchun AI so‘rovlar limiti tugadi.")

    mode = assistant.mode_for(task.spec)
    history = []
    for e in entries:
        history += [{"role": "student", "content": e["prompt"]}]
    result = await assistant.answer(mode, payload.content, task.title, (task.spec or {}).get("description", ""),
                                    payload.code, history)
    entries.append(assistant.log_entry(mode, payload.content, result))
    log.prompts_ref = entries
    flag_modified(log, "prompts_ref")
    await db.commit()
    return {**result, "mode": mode, "turns_used": len(entries), "turns_limit": assistant.MAX_TURNS_PER_ATTEMPT}


@router.post("/{attempt_id}/decisions")
async def decide(attempt_id: uuid.UUID, payload: DecisionPayload, user: User = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    """Records whether the student accepted or rejected a code suggestion (section 5.2)."""
    _, _, log = await _context(db, attempt_id, user)
    entries = list(log.prompts_ref or [])
    for e in entries:
        if e.get("suggestion_id") == payload.suggestion_id:
            e["decision"] = "accepted" if payload.accepted else "rejected"
            break
    else:
        raise HTTPException(status_code=404, detail="Taklif topilmadi")
    log.prompts_ref = entries
    log.accepted_ratio = assistant.accepted_ratio(entries)
    flag_modified(log, "prompts_ref")
    await db.commit()
    return {"accepted_ratio": log.accepted_ratio}
