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
from app.models import CareerProfile, Consent, Direction, EmployerCriteria, Evidence, Match, Skill, StudentProfile, User
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
            "course": profile.course if profile else None}


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


@employer_router.post("/candidates/{candidate_id}/invite")
async def invite_candidate(candidate_id: uuid.UUID, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                           db: AsyncSession = Depends(get_db)):
    if not any(s.id == candidate_id for s in await _consenting_students(db)):
        raise HTTPException(status_code=404, detail="Nomzod topilmadi")
    audit.record(db, actor_id=user.id, action="employer.invite", entity="user", entity_id=candidate_id, ip=client_ip(request))
    await db.commit()
    return {"status": "invited", "candidate_id": str(candidate_id)}
