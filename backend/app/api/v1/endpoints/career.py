"""Career DNA, AI Career Coach and employer search (sections 10, 12 "Career", "Ish beruvchi")."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import EMPLOYER, client_ip, get_current_user, require_roles
from app.core.database import get_db
from app.models import (CareerProfile, Consent, Credential, Direction, EmployerCriteria, EmployerInvite, Evidence, Match,
                        Skill, StudentProfile, User)
from app.services import audit, career, skill_service

router = APIRouter()  # /careers
legacy_router = APIRouter()  # /career (current student UI)
employer_router = APIRouter()


async def _skill_states(db: AsyncSession, user_id: uuid.UUID) -> tuple:
    """(code -> SkillState, code -> layer view) from the user's latest scores."""
    scores = await skill_service.latest_scores(db, [user_id])
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    states, layers = {}, {}
    for (_, sid), sc in scores.items():
        sk = skills.get(sid)
        if sk:
            states[sk.code] = career.SkillState(sc.score, sc.confidence, sk.name)
            layers[sk.code] = skill_service.layer_view(sc)
    # Name lookup also for required skills the student has no score in yet
    names = {sk.code: sk.name for sk in skills.values()}
    return states, layers, names


def _named(result: career.MatchResult, names: Dict[str, str]) -> career.MatchResult:
    for row in result.gaps + result.strengths:
        row["name"] = names.get(row["skill"], row["name"])
    return result


async def _profile_match(db: AsyncSession, user: User, profile: CareerProfile) -> dict:
    states, layers, names = await _skill_states(db, user.id)
    result = _named(career.match(career.parse_requirements(profile.requirements), states), names)
    plan = career.plan_30_60_90(result.gaps, layers)
    return {"profile": profile, "result": result, "plan": plan}


def _career_payload(m: dict) -> dict:
    p, r = m["profile"], m["result"]
    return {
        "id": str(p.id),
        "roleName": p.role_name,
        "description": p.description,
        "matchPct": r.match_pct,
        "gaps": r.gaps,
        "strengths": r.strengths,
        "missing_must": r.missing_must,
        "explanation": career.explanation(r),
        "roadmap": m["plan"],
    }


@router.get("")
async def list_careers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """GET /careers — job profiles for the student's direction with their match %."""
    profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))).scalars().first()
    q = select(CareerProfile).where(CareerProfile.is_deleted.is_(False))
    if profile and profile.direction_id:
        q = q.where(CareerProfile.direction_id == profile.direction_id)
    out = []
    for p in (await db.execute(q)).scalars().all():
        m = await _profile_match(db, user, p)
        out.append({"id": str(p.id), "roleName": p.role_name, "description": p.description, "matchPct": m["result"].match_pct,
                    "top_gap": m["result"].gaps[0] if m["result"].gaps else None})
    out.sort(key=lambda x: -(x["matchPct"] or -1))
    return out


async def _get_profile(db: AsyncSession, career_id: uuid.UUID) -> CareerProfile:
    p = (await db.execute(select(CareerProfile).where(CareerProfile.id == career_id))).scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Kasb profili topilmadi")
    return p


@router.get("/{career_id}/match")
async def career_match(career_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _profile_match(db, user, await _get_profile(db, career_id))
    db.add(Match(user_id=user.id, career_profile_id=career_id, match_pct=m["result"].match_pct or 0.0,
                 gaps=m["result"].gaps, explanation=career.explanation(m["result"]), computed_at=datetime.now(timezone.utc)))
    await db.commit()
    return _career_payload(m)


@router.get("/{career_id}/plan")
async def career_plan(career_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _profile_match(db, user, await _get_profile(db, career_id))
    return {"roleName": m["profile"].role_name, "matchPct": m["result"].match_pct, "plan": m["plan"]}


async def _best_profile(db: AsyncSession, user: User) -> Optional[dict]:
    profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))).scalars().first()
    q = select(CareerProfile).where(CareerProfile.is_deleted.is_(False))
    if profile and profile.direction_id:
        q = q.where(CareerProfile.direction_id == profile.direction_id)
    best = None
    for p in (await db.execute(q)).scalars().all():
        m = await _profile_match(db, user, p)
        if best is None or (m["result"].match_pct or -1) > (best["result"].match_pct or -1):
            best = m
    return best


@legacy_router.get("/target")
async def career_target(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Best-matching job profile for the student (used by the student career page)."""
    best = await _best_profile(db, user)
    if not best:
        return {"roleName": None, "matchPct": None, "gaps": [], "roadmap": [], "coachTip": "Yo‘nalishingiz uchun kasb profillari hali kiritilmagan."}
    payload = _career_payload(best)
    top = best["result"].gaps[0] if best["result"].gaps else None
    payload["coachTip"] = (f"Avval {top['name']} bo‘yicha {top['gap']} ballik bo‘shliqni yoping." if top
                           else "Barcha talablar bajarilgan — PROVE dalillari bilan Confidence’ni oshiring.")
    return payload


class CoachChatRequest(BaseModel):
    message: str = Field(max_length=2000)
    career_id: Optional[uuid.UUID] = None


@legacy_router.post("/coach-chat")
async def coach_chat(payload: CoachChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _profile_match(db, user, await _get_profile(db, payload.career_id)) if payload.career_id else await _best_profile(db, user)
    if not m:
        return {"reply": "Hali kasb profili tanlanmagan.", "recommended_action": "", "coach_avatar": "AI Career Coach"}
    out = await career.coach_reply(payload.message, m["profile"].role_name, m["result"], m["plan"])
    return {**out, "coach_avatar": "AI Career Coach"}


# ---------------------------------------------------------------------------
# Employer: criteria, consent-limited candidate search (section 10.4)
# ---------------------------------------------------------------------------

class CriteriaItem(BaseModel):
    skill_code: str
    min_score: float = Field(ge=0, le=100)
    importance: float = Field(default=1.0, gt=0)
    must: bool = False


class CriteriaCreate(BaseModel):
    job_title: str
    department: Optional[str] = None
    min_confidence: float = Field(default=0, ge=0, le=100)
    skills: List[CriteriaItem]


async def _consenting_students(db: AsyncSession) -> List[User]:
    rows = (
        await db.execute(
            select(User).join(Consent, Consent.user_id == User.id).where(
                User.role == "student", User.status == "active", User.is_deleted.is_(False),
                Consent.type == "employer_share", Consent.revoked_at.is_(None),
            )
        )
    ).scalars().unique().all()
    return list(rows)


@employer_router.post("/criteria")
async def create_criteria(payload: CriteriaCreate, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                          db: AsyncSession = Depends(get_db)):
    crit = EmployerCriteria(
        employer_id=user.id, job_title=payload.job_title, department=payload.department,
        criteria={"min_confidence": payload.min_confidence,
                  "skills": {i.skill_code: {"min_score": i.min_score, "importance": i.importance, "must": i.must} for i in payload.skills}},
    )
    db.add(crit)
    audit.record(db, actor_id=user.id, action="employer.criteria_create", entity="employer_criteria", entity_id=None,
                 after={"job_title": payload.job_title}, ip=client_ip(request))
    await db.commit()
    return {"id": str(crit.id), "job_title": crit.job_title}


@employer_router.get("/criteria")
async def list_criteria(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmployerCriteria).where(EmployerCriteria.employer_id == user.id))).scalars().all()
    return [{"id": str(c.id), "job_title": c.job_title, "department": c.department, "criteria": c.criteria, "status": c.status} for c in rows]


async def _candidate_summary(db: AsyncSession, student: User) -> dict:
    profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == student.id))).scalars().first()
    direction = None
    if profile and profile.direction_id:
        direction = (await db.execute(select(Direction).where(Direction.id == profile.direction_id))).scalars().first()
    return {"id": str(student.id), "name": student.full_name, "direction": direction.name if direction else None,
            "direction_code": direction.code if direction else None, "course": profile.course if profile else None}


@employer_router.get("/criteria/{criteria_id}/matches")
async def criteria_matches(criteria_id: uuid.UUID, user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    crit = (await db.execute(select(EmployerCriteria).where(EmployerCriteria.id == criteria_id))).scalars().first()
    if not crit or crit.employer_id != user.id:
        raise HTTPException(status_code=404, detail="Mezon topilmadi")
    reqs = career.parse_requirements(crit.criteria.get("skills", {}))
    min_conf = float(crit.criteria.get("min_confidence", 0))
    out = []
    for student in await _consenting_students(db):
        states, _, names = await _skill_states(db, student.id)
        # Employer thresholds are hard filters on verified score and confidence (section 10.4)
        if any(states.get(r.skill_code, career.SkillState(0, 0)).score < r.min_score for r in reqs if r.must):
            continue
        if reqs and any(states.get(r.skill_code, career.SkillState(0, 0)).confidence < min_conf for r in reqs):
            continue
        result = _named(career.match(reqs, states), names)
        if result.match_pct is None:
            continue
        out.append({**await _candidate_summary(db, student), "matchPct": result.match_pct,
                    "explanation": career.explanation(result), "gaps": result.gaps, "strengths": result.strengths})
        db.add(Match(user_id=student.id, employer_criteria_id=crit.id, match_pct=result.match_pct, gaps=result.gaps,
                     explanation=career.explanation(result), computed_at=datetime.now(timezone.utc)))
    await db.commit()
    out.sort(key=lambda c: -c["matchPct"])
    return out


@employer_router.get("/candidates/{candidate_id}")
async def candidate_profile(candidate_id: uuid.UUID, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                            db: AsyncSession = Depends(get_db)):
    """Only what the student shared: verified skills and the assessment trail behind them (sections 8, 10.4)."""
    if not any(s.id == candidate_id for s in await _consenting_students(db)):
        raise HTTPException(status_code=404, detail="Nomzod topilmadi yoki ma’lumot ulashishga rozilik bermagan")
    student = (await db.execute(select(User).where(User.id == candidate_id))).scalars().first()
    scores = await skill_service.latest_scores(db, [student.id])
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    evidence = (await db.execute(select(Evidence).where(Evidence.user_id == student.id, Evidence.status == "verified"))).scalars().all()
    audit.record(db, actor_id=user.id, action="employer.view_candidate", entity="user", entity_id=student.id, ip=client_ip(request))
    await db.commit()
    return {
        **await _candidate_summary(db, student),
        "skills": [
            {"code": skills[sid].code, "name": skills[sid].name, "score": sc.score, "confidence": sc.confidence,
             "level": sc.level, "layers": skill_service.layer_view(sc),
             "evidence": [{"layer": e.layer, "title": e.title, "verified_by": e.verified_by,
                           "human_verified": skill_service.is_human_verified(e), "date": e.created_at.date().isoformat()}
                          for e in evidence if e.skill_id == sid]}
            for (_, sid), sc in scores.items() if sid in skills
        ],
        "notice": "Platforma natijasi yuqori ta’sirli qarorning (ishga olish/bo‘shatish) yagona asosi bo‘lmasligi kerak.",
    }


def _level_rank(level: Optional[str]) -> int:
    try:
        return int((level or "L0")[1])
    except (IndexError, ValueError):
        return 0


@employer_router.get("/verified-candidates")
async def verified_candidates(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    """Talent pool: consenting students with at least one verified skill level (L1+), strongest first."""
    students = await _consenting_students(db)
    if not students:
        return []
    ids = [s.id for s in students]
    scores = await skill_service.latest_scores(db, ids)
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    evidence = (await db.execute(select(Evidence).where(Evidence.user_id.in_(ids), Evidence.status == "verified"))).scalars().all()
    creds = (await db.execute(select(Credential).where(Credential.user_id.in_(ids), Credential.status == "issued"))).scalars().all()
    out = []
    for student in students:
        own = [
            {"code": skills[sid].code, "name": skills[sid].name, "score": sc.score, "confidence": sc.confidence, "level": sc.level}
            for (uid, sid), sc in scores.items()
            if uid == student.id and sid in skills and _level_rank(sc.level) >= 1
        ]
        if not own:
            continue
        own.sort(key=lambda k: (-_level_rank(k["level"]), -(k["score"] or 0)))
        mine = [e for e in evidence if e.user_id == student.id]
        out.append({
            **await _candidate_summary(db, student),
            "skills": own,
            "best_level": own[0]["level"],
            "evidence_verified": len(mine),
            "human_verified": sum(1 for e in mine if skill_service.is_human_verified(e)),
            "credentials": sum(1 for c in creds if c.user_id == student.id),
        })
    out.sort(key=lambda c: (-_level_rank(c["best_level"]), -(c["skills"][0]["score"] or 0)))
    return out


class InviteCreate(BaseModel):
    job_title: str = Field(default="Umumiy taklif", min_length=2, max_length=255)
    message: Optional[str] = Field(default=None, max_length=2000)


def _invite_view(inv: EmployerInvite, other: Optional[User], extra: Optional[dict] = None) -> dict:
    return {
        "id": str(inv.id), "job_title": inv.job_title, "message": inv.message, "status": inv.status,
        "created_at": inv.created_at.isoformat(), "responded_at": inv.responded_at.isoformat() if inv.responded_at else None,
        "name": other.full_name if other else None, **(extra or {}),
    }


@employer_router.post("/candidates/{candidate_id}/invite")
async def invite_candidate(candidate_id: uuid.UUID, request: Request, payload: Optional[InviteCreate] = None,
                           user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    if not any(s.id == candidate_id for s in await _consenting_students(db)):
        raise HTTPException(status_code=404, detail="Nomzod topilmadi")
    payload = payload or InviteCreate()
    job_title = payload.job_title.strip()
    open_invite = (await db.execute(select(EmployerInvite).where(
        EmployerInvite.employer_id == user.id, EmployerInvite.candidate_id == candidate_id,
        EmployerInvite.job_title == job_title, EmployerInvite.status == "sent",
    ))).scalars().first()
    if open_invite:
        raise HTTPException(status_code=409, detail="Bu nomzodga shu lavozim bo‘yicha taklif allaqachon yuborilgan")
    inv = EmployerInvite(employer_id=user.id, candidate_id=candidate_id, job_title=job_title,
                         message=(payload.message or "").strip() or None)
    db.add(inv)
    await db.flush()
    audit.record(db, actor_id=user.id, action="employer.invite", entity="employer_invite", entity_id=inv.id,
                 after={"candidate_id": str(candidate_id), "job_title": job_title}, ip=client_ip(request))
    await db.commit()
    return {"status": "invited", "candidate_id": str(candidate_id), "invite_id": str(inv.id)}


@employer_router.get("/invites")
async def list_invites(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmployerInvite).where(EmployerInvite.employer_id == user.id)
                             .order_by(EmployerInvite.created_at.desc()))).scalars().all()
    ids = {r.candidate_id for r in rows}
    people = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    out = []
    for inv in rows:
        cand = people.get(inv.candidate_id)
        summary = await _candidate_summary(db, cand) if cand else {}
        summary.pop("id", None)
        out.append(_invite_view(inv, cand, {**summary, "candidate_id": str(inv.candidate_id)}))
    return out


@employer_router.post("/invites/{invite_id}/withdraw")
async def withdraw_invite(invite_id: uuid.UUID, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                          db: AsyncSession = Depends(get_db)):
    inv = (await db.execute(select(EmployerInvite).where(EmployerInvite.id == invite_id))).scalars().first()
    if not inv or inv.employer_id != user.id:
        raise HTTPException(status_code=404, detail="Taklif topilmadi")
    if inv.status != "sent":
        raise HTTPException(status_code=409, detail="Faqat javob kutilayotgan taklifni qaytarib olish mumkin")
    inv.status = "withdrawn"
    inv.responded_at = datetime.now(timezone.utc)
    audit.record(db, actor_id=user.id, action="employer.invite_withdraw", entity="employer_invite", entity_id=inv.id,
                 ip=client_ip(request))
    await db.commit()
    return {"id": str(inv.id), "status": inv.status}


# ---- Student side: invitations received ----

@legacy_router.get("/invites")
async def my_invites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmployerInvite).where(EmployerInvite.candidate_id == user.id,
                                                          EmployerInvite.status != "withdrawn")
                             .order_by(EmployerInvite.created_at.desc()))).scalars().all()
    ids = {r.employer_id for r in rows}
    people = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return [_invite_view(inv, people.get(inv.employer_id),
                         {"company": people[inv.employer_id].full_name if inv.employer_id in people else None})
            for inv in rows]


class InviteResponse(BaseModel):
    decision: str = Field(pattern="^(accepted|declined)$")


@legacy_router.post("/invites/{invite_id}/respond")
async def respond_invite(invite_id: uuid.UUID, payload: InviteResponse, request: Request,
                         user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    inv = (await db.execute(select(EmployerInvite).where(EmployerInvite.id == invite_id))).scalars().first()
    if not inv or inv.candidate_id != user.id:
        raise HTTPException(status_code=404, detail="Taklif topilmadi")
    if inv.status != "sent":
        raise HTTPException(status_code=409, detail="Bu taklifga allaqachon javob berilgan yoki u qaytarib olingan")
    inv.status = payload.decision
    inv.responded_at = datetime.now(timezone.utc)
    audit.record(db, actor_id=user.id, action=f"student.invite_{payload.decision}", entity="employer_invite",
                 entity_id=inv.id, ip=client_ip(request))
    await db.commit()
    return {"id": str(inv.id), "status": inv.status}
