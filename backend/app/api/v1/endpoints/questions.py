"""KNOW question bank: author, AI-generate, import and review questions (teachers and moderators).

Every new question starts as a draft; a second person (not the author) approves it before students see it.
"""
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import MODERATOR, SUPER_ADMIN, TEACHER, client_ip, require_roles
from app.core.database import get_db
from app.models import Question, Skill, User
from app.services import audit, llm, question_bank as qb

router = APIRouter()
STAFF = require_roles(TEACHER, MODERATOR)


def _row(q: Question, skills: dict, authors: dict) -> dict:
    sk = skills.get(q.skill_id)
    return {
        "id": str(q.id), "skill_id": str(q.skill_id), "skill_code": sk.code if sk else None, "skill": sk.name if sk else None,
        "text": q.text, "options": q.options, "answer_index": q.answer_index, "explanation": q.explanation,
        "difficulty": q.difficulty, "source": q.source, "status": q.status, "review_note": q.review_note,
        "author": authors.get(q.author_id), "author_id": str(q.author_id) if q.author_id else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


async def _lookups(db: AsyncSession, rows: List[Question]):
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    ids = {q.author_id for q in rows if q.author_id}
    authors = {u.id: u.full_name for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return skills, authors


async def _get(db: AsyncSession, question_id: uuid.UUID) -> Question:
    q = (await db.execute(select(Question).where(Question.id == question_id, Question.is_deleted.is_(False)))).scalars().first()
    if not q:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    return q


async def _skill(db: AsyncSession, skill_id: uuid.UUID) -> Skill:
    sk = (await db.execute(select(Skill).where(Skill.id == skill_id, Skill.is_deleted.is_(False)))).scalars().first()
    if not sk:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")
    return sk


# ---------------------------------------------------------------------------
# Browse
# ---------------------------------------------------------------------------

@router.get("/stats")
async def bank_stats(user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    """Per skill: approved and waiting questions, so authors see where the bank is thin."""
    counts = (await db.execute(
        select(Question.skill_id, Question.status, func.count(Question.id))
        .where(Question.is_deleted.is_(False)).group_by(Question.skill_id, Question.status)
    )).all()
    by_skill: dict = {}
    for sid, status, n in counts:
        by_skill.setdefault(sid, {})[status] = n
    skills = (await db.execute(select(Skill).where(Skill.is_deleted.is_(False)).order_by(Skill.code))).scalars().all()
    return [{"skill_id": str(s.id), "code": s.code, "name": s.name, "approved": by_skill.get(s.id, {}).get("approved", 0),
             "draft": by_skill.get(s.id, {}).get("draft", 0), "target": qb.KNOW_DRAW * 3} for s in skills]


@router.get("")
async def list_questions(skill_id: Optional[uuid.UUID] = None, status: Optional[str] = None, q: Optional[str] = None,
                         limit: int = 200, user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    query = select(Question).where(Question.is_deleted.is_(False))
    if skill_id:
        query = query.where(Question.skill_id == skill_id)
    if status:
        query = query.where(Question.status == status)
    if q:
        query = query.where(or_(Question.text.ilike(f"%{q}%"), Question.explanation.ilike(f"%{q}%")))
    rows = (await db.execute(query.order_by(Question.created_at.desc()).limit(max(1, min(limit, 500))))).scalars().all()
    skills, authors = await _lookups(db, rows)
    return [_row(r, skills, authors) for r in rows]


# ---------------------------------------------------------------------------
# 1. Author by hand
# ---------------------------------------------------------------------------

class QuestionIn(BaseModel):
    skill_id: uuid.UUID
    text: str = Field(max_length=2000)
    options: List[str] = Field(min_length=2, max_length=6)
    answer_index: int
    explanation: Optional[str] = Field(default=None, max_length=2000)
    difficulty: str = "L2"


def _checked(payload) -> qb.QuestionData:
    data = qb.QuestionData(text=payload.text, options=payload.options, answer_index=payload.answer_index,
                           explanation=payload.explanation, difficulty=payload.difficulty)
    errors = qb.validate(data)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return qb.clean(data)


@router.post("")
async def create_question(payload: QuestionIn, request: Request, user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    await _skill(db, payload.skill_id)
    d = _checked(payload)
    row = Question(skill_id=payload.skill_id, text=d.text, options=d.options, answer_index=d.answer_index,
                   explanation=d.explanation, difficulty=d.difficulty, source="manual", status="draft", author_id=user.id)
    db.add(row)
    await db.flush()
    audit.record(db, actor_id=user.id, action="question.create", entity="question", entity_id=row.id, ip=client_ip(request))
    await db.commit()
    skills, authors = await _lookups(db, [row])
    return _row(row, skills, authors)


class QuestionPatch(BaseModel):
    text: str = Field(max_length=2000)
    options: List[str] = Field(min_length=2, max_length=6)
    answer_index: int
    explanation: Optional[str] = Field(default=None, max_length=2000)
    difficulty: str = "L2"


@router.put("/{question_id}")
async def update_question(question_id: uuid.UUID, payload: QuestionPatch, request: Request, user: User = Depends(STAFF),
                          db: AsyncSession = Depends(get_db)):
    """An edit sends the question back to review: students only ever see reviewed text."""
    row = await _get(db, question_id)
    d = _checked(payload)
    row.text, row.options, row.answer_index, row.explanation, row.difficulty = d.text, d.options, d.answer_index, d.explanation, d.difficulty
    row.status, row.reviewer_id, row.review_note = "draft", None, None
    row.author_id = row.author_id or user.id
    audit.record(db, actor_id=user.id, action="question.update", entity="question", entity_id=row.id, ip=client_ip(request))
    await db.commit()
    skills, authors = await _lookups(db, [row])
    return _row(row, skills, authors)


@router.delete("/{question_id}")
async def delete_question(question_id: uuid.UUID, request: Request, user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    row = await _get(db, question_id)
    if user.role == TEACHER and row.author_id != user.id:
        raise HTTPException(status_code=403, detail="Faqat o‘zingiz yozgan savolni o‘chira olasiz")
    row.is_deleted = True
    audit.record(db, actor_id=user.id, action="question.delete", entity="question", entity_id=row.id, ip=client_ip(request))
    await db.commit()
    return {"status": "deleted"}


class ReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/{question_id}/review")
async def review_question(question_id: uuid.UUID, payload: ReviewIn, request: Request, user: User = Depends(STAFF),
                          db: AsyncSession = Depends(get_db)):
    row = await _get(db, question_id)
    if row.author_id == user.id and user.role != SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="O‘zingiz yozgan savolni boshqa o‘qituvchi yoki moderator tasdiqlashi kerak")
    row.status = "approved" if payload.action == "approve" else "rejected"
    row.reviewer_id, row.review_note = user.id, payload.note
    audit.record(db, actor_id=user.id, action=f"question.{payload.action}", entity="question", entity_id=row.id,
                 after={"note": payload.note}, ip=client_ip(request))
    await db.commit()
    return {"id": str(row.id), "status": row.status}


# ---------------------------------------------------------------------------
# 2. Generate drafts with AI
# ---------------------------------------------------------------------------

class GeneratedQuestion(BaseModel):
    text: str
    options: List[str]
    answer_index: int
    explanation: str
    difficulty: str


class GeneratedSet(BaseModel):
    questions: List[GeneratedQuestion]


class GenerateIn(BaseModel):
    skill_id: uuid.UUID
    count: int = Field(default=10, ge=1, le=20)
    difficulty: str = "L2"
    topic: Optional[str] = Field(default=None, max_length=300)


@router.post("/generate")
async def generate_questions(payload: GenerateIn, request: Request, user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    """AI drafts multiple-choice questions for a skill; they wait for human review like any other draft."""
    sk = await _skill(db, payload.skill_id)
    if not llm.enabled():
        raise HTTPException(status_code=503, detail="AI kaliti sozlanmagan (ANTHROPIC_API_KEY yoki GEMINI_API_KEY). Savollarni qo‘lda yoki CSV orqali qo‘shing.")
    existing = (await db.execute(select(Question.text).where(Question.skill_id == sk.id, Question.is_deleted.is_(False)).limit(60))).scalars().all()
    refs = sk.framework_refs or {}
    try:
        out = await llm.structured(
            system=("Siz SKILL DNA platformasi uchun o‘zbek tilida (lotin yozuvi) test savollari tuzuvchi metodistsiz. "
                    "Savollar talabaning tushunishini tekshiradi, yodlashni emas: amaliy vaziyat, sabab-oqibat, xato topish."),
            instruction=(f"Aynan {payload.count} ta bir javobli test savoli tuzing. Har birida 4 ta variant, faqat bittasi to‘g‘ri; "
                         "noto‘g‘ri variantlar ishonarli bo‘lsin. answer_index — to‘g‘ri variant tartib raqami (0 dan). "
                         "explanation — nega to‘g‘ri ekanini 1–2 gapda tushuntiring. "
                         f"difficulty qiymati: {payload.difficulty}. Mavjud savollarni takrorlamang."),
            data={"skill": f"{sk.code} — {sk.name}", "subskills": str(refs.get("subskills", "")),
                  "focus_topic": payload.topic or "", "level": payload.difficulty,
                  "existing_questions": "\n".join(existing)},
            schema=GeneratedSet,
            effort="low",
        )
    except llm.LLMUnavailable as e:
        raise HTTPException(status_code=503, detail=f"AI hozir javob bermadi ({e}). Keyinroq urinib ko‘ring.")
    created, skipped = [], 0
    for g in out.questions[: payload.count]:
        d = qb.QuestionData(text=g.text, options=g.options, answer_index=g.answer_index, explanation=g.explanation,
                            difficulty=g.difficulty if g.difficulty in qb.LEVELS else payload.difficulty)
        if qb.validate(d):
            skipped += 1
            continue
        d = qb.clean(d)
        row = Question(skill_id=sk.id, text=d.text, options=d.options, answer_index=d.answer_index, explanation=d.explanation,
                       difficulty=d.difficulty, source="ai", status="draft", author_id=user.id)
        db.add(row)
        created.append(row)
    await db.flush()
    audit.record(db, actor_id=user.id, action="question.generate", entity="skill", entity_id=sk.id,
                 after={"created": len(created), "skipped": skipped, "model": llm.model_ref()}, ip=client_ip(request))
    await db.commit()
    skills, authors = await _lookups(db, created)
    return {"created": [_row(r, skills, authors) for r in created], "skipped": skipped}


# ---------------------------------------------------------------------------
# 3. Import from CSV (Excel: "Save as CSV")
# ---------------------------------------------------------------------------

class ImportIn(BaseModel):
    csv: str = Field(max_length=2_000_000)
    dry_run: bool = False


@router.post("/import")
async def import_questions(payload: ImportIn, request: Request, user: User = Depends(STAFF), db: AsyncSession = Depends(get_db)):
    parsed = qb.parse_csv(payload.csv)
    skills = {s.code: s for s in (await db.execute(select(Skill).where(Skill.is_deleted.is_(False)))).scalars().all()}
    errors = list(parsed.errors)
    valid = []
    for i, d in enumerate(parsed.rows):
        if d.skill_code not in skills:
            errors.append({"line": None, "errors": [f"Noma’lum skill_code: {d.skill_code} («{d.text[:40]}…»)"]})
        else:
            valid.append(d)
    if not payload.dry_run:
        for d in valid:
            db.add(Question(skill_id=skills[d.skill_code].id, text=d.text, options=d.options, answer_index=d.answer_index,
                            explanation=d.explanation, difficulty=d.difficulty, source="import", status="draft", author_id=user.id))
        audit.record(db, actor_id=user.id, action="question.import", entity="question", entity_id=None,
                     after={"created": len(valid), "errors": len(errors)}, ip=client_ip(request))
        await db.commit()
    return {"valid": len(valid), "created": 0 if payload.dry_run else len(valid), "errors": errors[:100],
            "header": qb.CSV_HEADER, "skill_codes": sorted(skills)}
