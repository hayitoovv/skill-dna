"""Sponsored challenges and named scholarships (financial model: company-funded, platform-scored)."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import EMPLOYER, STUDENT, SUPER_ADMIN, TEACHER, UNIVERSITY, client_ip, get_current_user, require_roles
from app.api.v1.endpoints.rating import PUBLIC_CONSENT, _rated_students
from app.core.database import get_db
from app.models import (Attempt, CareerProfile, Consent, Direction, Evidence, Organization, Scholarship, ScholarshipAward,
                        Skill, SponsoredChallenge, Task, User)
from app.services import audit, career, rating
from app.services.notify import notify

router = APIRouter()

MAX_CHALLENGE_TASKS = 8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _org_names(db: AsyncSession, ids: Set[uuid.UUID]) -> Dict[uuid.UUID, str]:
    if not ids:
        return {}
    return {o.id: o.name for o in (await db.execute(select(Organization).where(Organization.id.in_(ids)))).scalars().all()}


async def _visible_names(db: AsyncSession, viewer: User, user_ids: List[uuid.UUID]) -> Set[str]:
    """Whose real name this viewer may see. Staff of the student's university see everyone of it; employers only
    students who share their profile with employers; students only classmates who made their rating public."""
    if not user_ids:
        return set()
    users = (await db.execute(select(User.id, User.org_id).where(User.id.in_(user_ids)))).all()
    if viewer.role == SUPER_ADMIN:
        return {str(u) for u, _ in users}
    if viewer.role in (TEACHER, UNIVERSITY):
        return {str(u) for u, org in users if org == viewer.org_id}
    consent = "employer_share" if viewer.role == EMPLOYER else PUBLIC_CONSENT
    rows = (await db.execute(select(Consent.user_id).where(Consent.type == consent, Consent.revoked_at.is_(None),
                                                           Consent.user_id.in_(user_ids)))).scalars().all()
    return {str(x) for x in rows} | {str(viewer.id)}


def _display(uid: str, name: str, visible: Set[str]) -> str:
    return name if uid in visible else f"Talaba #{uid[-4:].upper()}"


# ---------------------------------------------------------------------------
# Sponsored challenges
# ---------------------------------------------------------------------------

async def _challenge_results(db: AsyncSession, ch: SponsoredChallenge) -> List[rating.RankedStudent]:
    """Best verified evidence score per (student, challenge task) inside the challenge window."""
    task_ids = [uuid.UUID(t) for t in (ch.task_ids or [])]
    if not task_ids:
        return []
    rows = (await db.execute(
        select(Evidence.user_id, Attempt.task_id, func.max(Evidence.score))
        .join(Attempt, Attempt.id == Evidence.attempt_id)
        .where(Attempt.task_id.in_(task_ids), Evidence.status == "verified", Evidence.is_deleted.is_(False),
               Evidence.created_at >= ch.starts_at, Evidence.created_at <= ch.ends_at)
        .group_by(Evidence.user_id, Attempt.task_id)
    )).all()
    best: Dict[str, Dict[str, float]] = {}
    for uid, tid, score in rows:
        best.setdefault(str(uid), {})[str(tid)] = float(score)
    students = [rating.RatedStudent(user_id=u, score=rating.challenge_score(b, len(task_ids))) for u, b in best.items()]
    return rating.rank(students)


async def _challenge_card(db: AsyncSession, ch: SponsoredChallenge, viewer: User, orgs: Dict[uuid.UUID, str]) -> Dict:
    ranked = await _challenge_results(db, ch)
    mine = rating.position(ranked, str(viewer.id))
    return {
        "id": str(ch.id), "title": ch.title, "description": ch.description, "company": orgs.get(ch.org_id),
        "company_id": str(ch.org_id), "prize_note": ch.prize_note, "task_count": len(ch.task_ids or []),
        "starts_at": ch.starts_at.isoformat(), "ends_at": ch.ends_at.isoformat(),
        "status": "closed" if ch.status == "closed" or ch.ends_at < _now() else "active",
        "participants": len(ranked),
        "me": {"rank": mine.rank, "total": mine.total, "score": mine.student.score} if mine else None,
    }


@router.get("/challenges")
async def list_challenges(viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(SponsoredChallenge).where(SponsoredChallenge.is_deleted.is_(False))
    if viewer.role == EMPLOYER:
        q = q.where(SponsoredChallenge.org_id == viewer.org_id)
    rows = (await db.execute(q.order_by(SponsoredChallenge.ends_at.desc()))).scalars().all()
    orgs = await _org_names(db, {c.org_id for c in rows})
    cards = [await _challenge_card(db, c, viewer, orgs) for c in rows]
    cards.sort(key=lambda c: (c["status"] != "active", c["ends_at"]))
    return cards


@router.get("/challenges/{challenge_id}")
async def challenge_detail(challenge_id: uuid.UUID, viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ch = (await db.execute(select(SponsoredChallenge).where(SponsoredChallenge.id == challenge_id,
                                                            SponsoredChallenge.is_deleted.is_(False)))).scalars().first()
    if not ch or (viewer.role == EMPLOYER and ch.org_id != viewer.org_id):
        raise HTTPException(status_code=404, detail="Tanlov topilmadi")
    orgs = await _org_names(db, {ch.org_id})
    card = await _challenge_card(db, ch, viewer, orgs)
    task_ids = [uuid.UUID(t) for t in (ch.task_ids or [])]
    tasks = (await db.execute(select(Task, Skill.name).join(Skill, Skill.id == Task.skill_id).where(Task.id.in_(task_ids)))).all()
    ranked = (await _challenge_results(db, ch))[:10]
    users = {str(u.id): u for u in (await db.execute(select(User).where(User.id.in_([uuid.UUID(r.student.user_id) for r in ranked])))).scalars().all()} if ranked else {}
    visible = await _visible_names(db, viewer, [uuid.UUID(r.student.user_id) for r in ranked])
    return {
        **card,
        "tasks": [{"id": str(t.id), "title": t.title, "layer": t.layer, "skill": name, "duration_minutes": t.duration_minutes}
                  for t, name in tasks],
        "leaderboard": [{"rank": r.rank, "score": r.student.score, "is_me": r.student.user_id == str(viewer.id),
                         "name": _display(r.student.user_id, users[r.student.user_id].full_name if r.student.user_id in users else "", visible)}
                        for r in ranked],
    }


class ChallengeIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    career_id: Optional[uuid.UUID] = None
    task_ids: List[uuid.UUID] = Field(default_factory=list)
    prize_note: Optional[str] = Field(default=None, max_length=255)
    days: int = Field(default=30, ge=1, le=365)


@router.post("/challenges")
async def create_challenge(payload: ChallengeIn, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                           db: AsyncSession = Depends(get_db)):
    """Tasks are picked explicitly, or taken from the profession's required skills (active tasks, up to 8)."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="Akkauntingiz korxonaga biriktirilmagan")
    task_ids = list(dict.fromkeys(payload.task_ids))[:MAX_CHALLENGE_TASKS]
    if not task_ids and payload.career_id:
        prof = (await db.execute(select(CareerProfile).where(CareerProfile.id == payload.career_id))).scalars().first()
        if not prof:
            raise HTTPException(status_code=404, detail="Kasb topilmadi")
        codes = [r.skill_code for r in career.parse_requirements(prof.requirements)]
        task_ids = list((await db.execute(
            select(Task.id).join(Skill, Skill.id == Task.skill_id)
            .where(Skill.code.in_(codes), Task.status == "active", Task.is_deleted.is_(False)).limit(MAX_CHALLENGE_TASKS)
        )).scalars().all())
    if not task_ids:
        raise HTTPException(status_code=400, detail="Tanlov uchun kamida bitta topshiriq tanlang yoki kasbni ko‘rsating")
    found = set((await db.execute(select(Task.id).where(Task.id.in_(task_ids)))).scalars().all())
    if len(found) != len(task_ids):
        raise HTTPException(status_code=404, detail="Ba’zi topshiriqlar topilmadi")
    start = _now()
    ch = SponsoredChallenge(org_id=user.org_id, created_by=user.id, title=payload.title.strip(), description=payload.description,
                            career_profile_id=payload.career_id, task_ids=[str(t) for t in task_ids],
                            prize_note=payload.prize_note, starts_at=start, ends_at=start + timedelta(days=payload.days))
    db.add(ch)
    await db.flush()
    audit.record(db, actor_id=user.id, action="challenge.create", entity="sponsored_challenge", entity_id=ch.id,
                 after={"title": ch.title, "tasks": len(task_ids)}, ip=client_ip(request))
    await db.commit()
    return {"id": str(ch.id), "task_count": len(task_ids)}


@router.post("/challenges/{challenge_id}/close")
async def close_challenge(challenge_id: uuid.UUID, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                          db: AsyncSession = Depends(get_db)):
    ch = (await db.execute(select(SponsoredChallenge).where(SponsoredChallenge.id == challenge_id,
                                                            SponsoredChallenge.org_id == user.org_id))).scalars().first()
    if not ch:
        raise HTTPException(status_code=404, detail="Tanlov topilmadi")
    ch.status = "closed"
    if ch.ends_at > _now():
        ch.ends_at = _now()
    audit.record(db, actor_id=user.id, action="challenge.close", entity="sponsored_challenge", entity_id=ch.id, ip=client_ip(request))
    await db.commit()
    return {"status": "closed"}


# ---------------------------------------------------------------------------
# Scholarships
# ---------------------------------------------------------------------------

async def _scholarship_ranking(db: AsyncSession, sch: Scholarship) -> List[rating.RankedStudent]:
    students, _, _ = await _rated_students(db, sch.university_org_id)
    if sch.direction_id:
        students = [s for s in students if s.direction_id == str(sch.direction_id)]
    return rating.rank(students)


async def _scholarship_card(db: AsyncSession, sch: Scholarship, viewer: User, orgs: Dict[uuid.UUID, str],
                            directions: Dict[uuid.UUID, str]) -> Dict:
    awarded = (await db.execute(select(func.count(ScholarshipAward.id)).where(ScholarshipAward.scholarship_id == sch.id))).scalar()
    card = {
        "id": str(sch.id), "title": sch.title, "company": orgs.get(sch.org_id), "university": orgs.get(sch.university_org_id),
        "university_id": str(sch.university_org_id), "amount_note": sch.amount_note, "slots": sch.slots,
        "direction": directions.get(sch.direction_id) if sch.direction_id else None, "description": sch.description,
        "deadline": sch.deadline.isoformat() if sch.deadline else None, "status": sch.status, "awarded": awarded,
        "me": None,
    }
    if viewer.role == STUDENT:
        mine = rating.position(await _scholarship_ranking(db, sch), str(viewer.id))
        won = (await db.execute(select(ScholarshipAward.id).where(ScholarshipAward.scholarship_id == sch.id,
                                                                  ScholarshipAward.user_id == viewer.id))).scalar()
        if mine:
            card["me"] = {"rank": mine.rank, "total": mine.total, "within_slots": mine.rank <= sch.slots, "awarded": bool(won)}
    return card


@router.get("/scholarships")
async def list_scholarships(viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Scholarship).where(Scholarship.is_deleted.is_(False))
    if viewer.role == EMPLOYER:
        q = q.where(Scholarship.org_id == viewer.org_id)
    elif viewer.role != SUPER_ADMIN:
        q = q.where(Scholarship.university_org_id == viewer.org_id)
    rows = (await db.execute(q.order_by(Scholarship.created_at.desc()))).scalars().all()
    orgs = await _org_names(db, {r.org_id for r in rows} | {r.university_org_id for r in rows})
    directions = {d.id: d.name for d in (await db.execute(select(Direction))).scalars().all()}
    return [await _scholarship_card(db, r, viewer, orgs, directions) for r in rows]


@router.get("/universities")
async def list_universities(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Organization).where(Organization.type == "university", Organization.is_deleted.is_(False))
                             .order_by(Organization.name))).scalars().all()
    directions = (await db.execute(select(Direction))).scalars().all()
    return {"universities": [{"id": str(o.id), "name": o.name} for o in rows],
            "directions": [{"id": str(d.id), "name": d.name} for d in directions]}


class ScholarshipIn(BaseModel):
    university_org_id: uuid.UUID
    title: str = Field(min_length=3, max_length=255)
    amount_note: Optional[str] = Field(default=None, max_length=120)
    slots: int = Field(default=1, ge=1, le=100)
    direction_id: Optional[uuid.UUID] = None
    description: Optional[str] = Field(default=None, max_length=4000)
    deadline_days: Optional[int] = Field(default=None, ge=1, le=365)


@router.post("/scholarships")
async def create_scholarship(payload: ScholarshipIn, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                             db: AsyncSession = Depends(get_db)):
    if not user.org_id:
        raise HTTPException(status_code=400, detail="Akkauntingiz korxonaga biriktirilmagan")
    uni = (await db.execute(select(Organization).where(Organization.id == payload.university_org_id,
                                                       Organization.type == "university"))).scalars().first()
    if not uni:
        raise HTTPException(status_code=404, detail="Universitet topilmadi")
    sch = Scholarship(org_id=user.org_id, university_org_id=uni.id, created_by=user.id, title=payload.title.strip(),
                      amount_note=payload.amount_note, slots=payload.slots, direction_id=payload.direction_id,
                      description=payload.description,
                      deadline=_now() + timedelta(days=payload.deadline_days) if payload.deadline_days else None)
    db.add(sch)
    await db.flush()
    audit.record(db, actor_id=user.id, action="scholarship.create", entity="scholarship", entity_id=sch.id,
                 after={"title": sch.title, "university": uni.name, "slots": sch.slots}, ip=client_ip(request))
    await db.commit()
    return {"id": str(sch.id)}


async def _scholarship_for(db: AsyncSession, viewer: User, scholarship_id: uuid.UUID) -> Scholarship:
    sch = (await db.execute(select(Scholarship).where(Scholarship.id == scholarship_id, Scholarship.is_deleted.is_(False)))).scalars().first()
    allowed = sch and (viewer.role == SUPER_ADMIN or (viewer.role == UNIVERSITY and sch.university_org_id == viewer.org_id)
                       or (viewer.role == EMPLOYER and sch.org_id == viewer.org_id))
    if not allowed:
        raise HTTPException(status_code=404, detail="Stipendiya topilmadi")
    return sch


@router.get("/scholarships/{scholarship_id}/candidates")
async def scholarship_candidates(scholarship_id: uuid.UUID, viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Top of the rating in the scholarship's scope (three times the slots), with awards already made."""
    sch = await _scholarship_for(db, viewer, scholarship_id)
    ranked = (await _scholarship_ranking(db, sch))[: sch.slots * 3]
    ids = [uuid.UUID(r.student.user_id) for r in ranked]
    users = {str(u.id): u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    visible = await _visible_names(db, viewer, ids)
    awarded = {str(a) for a in (await db.execute(select(ScholarshipAward.user_id).where(
        ScholarshipAward.scholarship_id == sch.id))).scalars().all()}
    return {
        "slots": sch.slots, "status": sch.status,
        "candidates": [{"user_id": r.student.user_id if viewer.role in (UNIVERSITY, SUPER_ADMIN) else None,
                        "rank": r.rank, "score": r.student.score, "group": r.student.group_id,
                        "name": _display(r.student.user_id, users[r.student.user_id].full_name, visible),
                        "awarded": r.student.user_id in awarded} for r in ranked],
    }


class AwardIn(BaseModel):
    user_ids: List[uuid.UUID] = Field(min_length=1, max_length=100)


@router.post("/scholarships/{scholarship_id}/award")
async def award_scholarship(scholarship_id: uuid.UUID, payload: AwardIn, request: Request,
                            user: User = Depends(require_roles(UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    """The university awards it: only students of that university, at most `slots` in total."""
    sch = await _scholarship_for(db, user, scholarship_id)
    if user.role == EMPLOYER:
        raise HTTPException(status_code=403, detail="Stipendiyani universitet beradi")
    ranked = {r.student.user_id: r for r in await _scholarship_ranking(db, sch)}
    existing = {str(a) for a in (await db.execute(select(ScholarshipAward.user_id).where(
        ScholarshipAward.scholarship_id == sch.id))).scalars().all()}
    new = [str(u) for u in dict.fromkeys(payload.user_ids) if str(u) not in existing]
    if any(u not in ranked for u in new):
        raise HTTPException(status_code=400, detail="Talaba bu stipendiya doirasida emas")
    if len(existing) + len(new) > sch.slots:
        raise HTTPException(status_code=400, detail=f"Stipendiya o‘rinlari soni: {sch.slots}")
    company = (await _org_names(db, {sch.org_id})).get(sch.org_id, "")
    for uid in new:
        r = ranked[uid]
        db.add(ScholarshipAward(scholarship_id=sch.id, user_id=uuid.UUID(uid), awarded_by=user.id,
                                rank_at_award=r.rank, score_at_award=str(r.student.score)))
        notify(db, uuid.UUID(uid), kind="scholarship_awarded", title=f"Tabriklaymiz! {sch.title}",
               body=f"{company} stipendiyasi sizga berildi.", link="student:companies")
    if len(existing) + len(new) >= sch.slots:
        sch.status = "awarded"
    audit.record(db, actor_id=user.id, action="scholarship.award", entity="scholarship", entity_id=sch.id,
                 after={"awarded": new}, ip=client_ip(request))
    await db.commit()
    return {"status": sch.status, "awarded": len(existing) + len(new)}
