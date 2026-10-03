from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models import VivaSession, VivaTurn, Attempt, Task, Skill
from app.schemas.assessment import VivaMessagePayload
from app.services.viva_engine import get_viva_initial_question, evaluate_viva_turn
from datetime import datetime, timezone
import uuid

router = APIRouter()

@router.post("/session/start")
async def start_viva_session(attempt_id: str, db: AsyncSession = Depends(get_db)):
    try:
        aid = uuid.UUID(attempt_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri Attempt ID")

    att_res = await db.execute(select(Attempt).where(Attempt.id == aid))
    attempt = att_res.scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Urinish topilmadi")

    # Check if viva session already exists
    sess_res = await db.execute(
        select(VivaSession).where(VivaSession.attempt_id == aid).options(selectinload(VivaSession.turns))
    )
    session = sess_res.scalars().first()

    if not session:
        session = VivaSession(
            attempt_id=aid,
            mode="text",
            language="uz",
            started_at=datetime.now(timezone.utc)
        )
        db.add(session)
        await db.flush()

        # Add initial examiner question
        initial_q = get_viva_initial_question()
        first_turn = VivaTurn(
            session_id=session.id,
            role="examiner",
            content=initial_q,
            ts=datetime.now(timezone.utc)
        )
        db.add(first_turn)
        await db.commit()
        await db.refresh(session)
        turns = [first_turn]
    else:
        turns = session.turns

    return {
        "session_id": str(session.id),
        "status": "active" if not session.ended_at else "completed",
        "turns": [
            {
                "id": str(t.id),
                "role": t.role,
                "content": t.content,
                "ts": t.ts.isoformat()
            }
            for t in turns
        ]
    }

@router.post("/message")
async def send_viva_message(payload: VivaMessagePayload, db: AsyncSession = Depends(get_db)):
    sess_res = await db.execute(
        select(VivaSession).where(VivaSession.id == payload.session_id).options(selectinload(VivaSession.turns))
    )
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Viva sessiyasi topilmadi")

    if session.ended_at:
        raise HTTPException(status_code=400, detail="Ushbu Viva sessiyasi allaqachon yakunlangan")

    # Save student response turn
    student_turn = VivaTurn(
        session_id=session.id,
        role="student",
        content=payload.content,
        ts=datetime.now(timezone.utc)
    )
    db.add(student_turn)
    await db.flush()

    history = [{"role": t.role, "content": t.content} for t in session.turns]
    history.append({"role": "student", "content": payload.content})

    eval_result = evaluate_viva_turn(history, payload.content)

    examiner_reply = None
    if eval_result.get("next_question"):
        examiner_reply = VivaTurn(
            session_id=session.id,
            role="examiner",
            content=eval_result["next_question"],
            ts=datetime.now(timezone.utc)
        )
        db.add(examiner_reply)
    elif eval_result.get("is_completed"):
        session.ended_at = datetime.now(timezone.utc)
        examiner_reply = VivaTurn(
            session_id=session.id,
            role="examiner",
            content=f"Tabriklaymiz! AI Viva himoyasi muvaffaqiyatli yakunlandi. Ballingiz: {eval_result['score']}/100. Xulosa: {eval_result['feedback']}",
            ts=datetime.now(timezone.utc)
        )
        db.add(examiner_reply)

    await db.commit()

    return {
        "score": eval_result["score"],
        "feedback": eval_result["feedback"],
        "is_completed": eval_result["is_completed"],
        "reply": examiner_reply.content if examiner_reply else None
    }
