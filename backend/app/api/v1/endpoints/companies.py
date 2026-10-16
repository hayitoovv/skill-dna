"""Companies, vacancies tied to professions, hiring statistics and the employer plan."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import EMPLOYER, STUDENT, SUPER_ADMIN, UNIVERSITY, client_ip, get_current_user, require_roles
from app.core.database import get_db
from app.models import CareerProfile, EmployerInvite, EmployerPlan, HiringStat, Organization, User, Vacancy
from app.services import audit, career, companies

router = APIRouter()

EMPLOYMENT_TYPES = {"full_time", "part_time", "internship"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _profile(org: Organization) -> Dict:
    s = org.settings or {}
    return {"industry": s.get("industry"), "region": s.get("region") or s.get("city"), "website": s.get("website"),
            "about": s.get("about"), "demo": bool(s.get("demo"))}


async def _company(db: AsyncSession, company_id: uuid.UUID) -> Organization:
    org = (await db.execute(select(Organization).where(Organization.id == company_id, Organization.type == "company",
                                                      Organization.is_deleted.is_(False)))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Korxona topilmadi")
    return org


async def _hires(db: AsyncSession, company_id: uuid.UUID, university_id: Optional[uuid.UUID]) -> List[Dict]:
    mq = select(HiringStat.year, HiringStat.hired_count).where(HiringStat.company_org_id == company_id, HiringStat.is_deleted.is_(False))
    if university_id:
        mq = mq.where(HiringStat.university_org_id == university_id)
    manual = (await db.execute(mq)).all()

    employer, candidate = aliased(User), aliased(User)
    year = extract("year", EmployerInvite.responded_at)
    pq = (select(year, func.count(EmployerInvite.id))
          .join(employer, employer.id == EmployerInvite.employer_id)
          .join(candidate, candidate.id == EmployerInvite.candidate_id)
          .where(employer.org_id == company_id, EmployerInvite.status == "accepted", EmployerInvite.responded_at.is_not(None))
          .group_by(year))
    if university_id:
        pq = pq.where(candidate.org_id == university_id)
    platform = [(int(y), n) for y, n in (await db.execute(pq)).all()]
    return companies.merge_hires(manual, platform)


async def _card(db: AsyncSession, org: Organization, university_id: Optional[uuid.UUID]) -> Dict:
    vac = (await db.execute(select(func.count(Vacancy.id), func.coalesce(func.sum(Vacancy.openings), 0)).where(
        Vacancy.org_id == org.id, Vacancy.status == "open", Vacancy.is_deleted.is_(False)))).one()
    hires = await _hires(db, org.id, university_id)
    last_year = datetime.now(timezone.utc).year - 1
    last = next((h for h in hires if h["year"] == last_year), None)
    return {
        "id": str(org.id), "name": org.name, **_profile(org),
        "open_vacancies": vac[0], "openings": int(vac[1]),
        "hires_last_year": {"year": last_year, "hired": last["hired"] if last else 0},
    }


def _vacancy_row(v: Vacancy, role_name: Optional[str]) -> Dict:
    return {"id": str(v.id), "title": v.title, "career_id": str(v.career_profile_id), "career": role_name,
            "openings": v.openings, "employment_type": v.employment_type, "city": v.city, "salary_note": v.salary_note,
            "description": v.description, "status": v.status, "created_at": v.created_at.isoformat() if v.created_at else None}


async def _role_names(db: AsyncSession) -> Dict[uuid.UUID, str]:
    return {p.id: p.role_name for p in (await db.execute(select(CareerProfile))).scalars().all()}


def _viewer_university(viewer: User) -> Optional[uuid.UUID]:
    """Students and university staff see hires from their own university; others see all hires."""
    return viewer.org_id if viewer.role in (STUDENT, UNIVERSITY) else None


async def _own_company(db: AsyncSession, user: User) -> Organization:
    if not user.org_id:
        raise HTTPException(status_code=400, detail="Akkauntingiz korxonaga biriktirilmagan")
    return await _company(db, user.org_id)


async def _plan(db: AsyncSession, org_id: uuid.UUID) -> EmployerPlan:
    plan = (await db.execute(select(EmployerPlan).where(EmployerPlan.org_id == org_id))).scalars().first()
    if not plan:
        plan = EmployerPlan(org_id=org_id, tier="free", credits_used=0)
        db.add(plan)
        await db.flush()
    return plan


async def spend_invite_credit(db: AsyncSession, user: User) -> None:
    """Called by the invite endpoint: one credit per new invite; 402 when this month's credits are used up."""
    if not user.org_id:
        return
    plan = await _plan(db, user.org_id)
    now = datetime.now(timezone.utc)
    start, used = companies.current_usage(plan.tier, plan.period_start, plan.credits_used, now)
    view = companies.plan_view(plan.tier, start, used, now)
    if view["left"] <= 0:
        raise HTTPException(status_code=402, detail=f"Bu oy uchun takliflar limiti tugadi ({view['limit']} ta). "
                                                    f"Limit {view['resets_on']} da yangilanadi yoki Pro tarifga o‘ting.")
    plan.period_start, plan.credits_used = start, used + 1


# ---------------------------------------------------------------------------
# Everyone: company list and profile
# ---------------------------------------------------------------------------

@router.get("")
async def list_companies(career_id: Optional[uuid.UUID] = None, viewer: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    """Companies with open vacancies, openings and last year's hires (from the viewer's university for students)."""
    q = select(Organization).where(Organization.type == "company", Organization.is_deleted.is_(False))
    if career_id:
        q = q.where(Organization.id.in_(select(Vacancy.org_id).where(
            Vacancy.career_profile_id == career_id, Vacancy.status == "open", Vacancy.is_deleted.is_(False))))
    uni = _viewer_university(viewer)
    cards = [await _card(db, org, uni) for org in (await db.execute(q.order_by(Organization.name))).scalars().all()]
    cards.sort(key=lambda c: (-c["open_vacancies"], c["name"]))
    return cards


@router.get("/me")
async def my_company(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    org = await _own_company(db, user)
    plan = await _plan(db, org.id)
    await db.commit()
    return {**await _card(db, org, None),
            "plan": companies.plan_view(plan.tier, plan.period_start, plan.credits_used, datetime.now(timezone.utc))}


@router.get("/{company_id}")
async def company_detail(company_id: uuid.UUID, viewer: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = await _company(db, company_id)
    names = await _role_names(db)
    vacancies = (await db.execute(select(Vacancy).where(Vacancy.org_id == org.id, Vacancy.status == "open",
                                                        Vacancy.is_deleted.is_(False)).order_by(Vacancy.created_at.desc()))).scalars().all()
    rows = [_vacancy_row(v, names.get(v.career_profile_id)) for v in vacancies]
    if viewer.role == STUDENT and vacancies:
        # The student's own fit for each vacancy's profession
        from app.api.v1.endpoints.career import _skill_states  # shared with career matching
        states, _, _ = await _skill_states(db, viewer.id)
        profiles = {p.id: p for p in (await db.execute(select(CareerProfile).where(
            CareerProfile.id.in_([v.career_profile_id for v in vacancies])))).scalars().all()}
        for row, v in zip(rows, vacancies):
            reqs = career.parse_requirements(profiles[v.career_profile_id].requirements) if v.career_profile_id in profiles else []
            row["readiness"] = career.readiness(reqs, states)
            row["matchPct"] = career.match(reqs, states).match_pct
    uni = _viewer_university(viewer)
    return {**await _card(db, org, uni), "vacancies": rows, "hires": await _hires(db, org.id, uni)}


# ---------------------------------------------------------------------------
# University / super admin: create companies, record hiring statistics
# ---------------------------------------------------------------------------

class CompanyIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    industry: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    website: Optional[str] = Field(default=None, max_length=255)
    about: Optional[str] = Field(default=None, max_length=2000)


def _apply_profile(org: Organization, payload: CompanyIn) -> None:
    s = dict(org.settings or {})
    for key in ("industry", "region", "website", "about"):
        value = getattr(payload, key)
        s[key] = value.strip() if isinstance(value, str) and value.strip() else None
    s.pop("demo", None)  # edited by a real person: no longer sample data
    org.settings = s
    org.name = payload.name.strip()


@router.post("")
async def create_company(payload: CompanyIn, request: Request, user: User = Depends(require_roles(UNIVERSITY)),
                         db: AsyncSession = Depends(get_db)):
    org = Organization(name=payload.name.strip(), type="company", settings={})
    _apply_profile(org, payload)
    db.add(org)
    await db.flush()
    audit.record(db, actor_id=user.id, action="company.create", entity="organization", entity_id=org.id,
                 after={"name": org.name}, ip=client_ip(request))
    await db.commit()
    return {"id": str(org.id), "name": org.name}


@router.put("/me")
async def update_my_company(payload: CompanyIn, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                            db: AsyncSession = Depends(get_db)):
    org = await _own_company(db, user)
    _apply_profile(org, payload)
    audit.record(db, actor_id=user.id, action="company.update", entity="organization", entity_id=org.id,
                 after={"name": org.name}, ip=client_ip(request))
    await db.commit()
    return await _card(db, org, None)


class HiringStatIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    hired_count: int = Field(ge=0, le=100000)
    note: Optional[str] = Field(default=None, max_length=255)
    university_org_id: Optional[uuid.UUID] = None  # super admin only; university staff record for their own university


@router.post("/{company_id}/hiring-stats")
async def record_hiring_stat(company_id: uuid.UUID, payload: HiringStatIn, request: Request,
                             user: User = Depends(require_roles(UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    """Upsert: one figure per company, university and year."""
    org = await _company(db, company_id)
    uni = payload.university_org_id if user.role == SUPER_ADMIN else user.org_id
    stat = (await db.execute(select(HiringStat).where(
        HiringStat.company_org_id == org.id, HiringStat.university_org_id == uni, HiringStat.year == payload.year,
        HiringStat.is_deleted.is_(False)))).scalars().first()
    if stat:
        stat.hired_count, stat.note, stat.entered_by = payload.hired_count, payload.note, user.id
    else:
        stat = HiringStat(company_org_id=org.id, university_org_id=uni, year=payload.year, hired_count=payload.hired_count,
                          note=payload.note, entered_by=user.id)
        db.add(stat)
    await db.flush()
    audit.record(db, actor_id=user.id, action="company.hiring_stat", entity="hiring_stat", entity_id=stat.id,
                 after={"company": org.name, "year": payload.year, "hired": payload.hired_count}, ip=client_ip(request))
    await db.commit()
    return {"id": str(stat.id), "hires": await _hires(db, org.id, uni)}


# ---------------------------------------------------------------------------
# Employer: own vacancies and candidates ranked for a vacancy
# ---------------------------------------------------------------------------

class VacancyIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    career_id: uuid.UUID
    openings: int = Field(default=1, ge=1, le=1000)
    employment_type: str = "full_time"
    city: Optional[str] = Field(default=None, max_length=100)
    salary_note: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=4000)


class VacancyPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    openings: Optional[int] = Field(default=None, ge=1, le=1000)
    status: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    salary_note: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=4000)


@router.get("/me/vacancies")
async def my_vacancies(user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    org = await _own_company(db, user)
    names = await _role_names(db)
    rows = (await db.execute(select(Vacancy).where(Vacancy.org_id == org.id, Vacancy.is_deleted.is_(False))
                             .order_by(Vacancy.status.desc(), Vacancy.created_at.desc()))).scalars().all()
    return [_vacancy_row(v, names.get(v.career_profile_id)) for v in rows]


@router.post("/me/vacancies")
async def create_vacancy(payload: VacancyIn, request: Request, user: User = Depends(require_roles(EMPLOYER)),
                         db: AsyncSession = Depends(get_db)):
    org = await _own_company(db, user)
    if payload.employment_type not in EMPLOYMENT_TYPES:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri bandlik turi")
    prof = (await db.execute(select(CareerProfile).where(CareerProfile.id == payload.career_id))).scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Kasb topilmadi")
    v = Vacancy(org_id=org.id, created_by=user.id, career_profile_id=prof.id, title=payload.title.strip(),
                openings=payload.openings, employment_type=payload.employment_type, city=payload.city,
                salary_note=payload.salary_note, description=payload.description, status="open")
    db.add(v)
    await db.flush()
    audit.record(db, actor_id=user.id, action="vacancy.create", entity="vacancy", entity_id=v.id,
                 after={"title": v.title, "career": prof.role_name}, ip=client_ip(request))
    await db.commit()
    return _vacancy_row(v, prof.role_name)


async def _own_vacancy(db: AsyncSession, user: User, vacancy_id: uuid.UUID) -> Vacancy:
    org = await _own_company(db, user)
    v = (await db.execute(select(Vacancy).where(Vacancy.id == vacancy_id, Vacancy.org_id == org.id,
                                                Vacancy.is_deleted.is_(False)))).scalars().first()
    if not v:
        raise HTTPException(status_code=404, detail="Vakansiya topilmadi")
    return v


@router.patch("/me/vacancies/{vacancy_id}")
async def update_vacancy(vacancy_id: uuid.UUID, payload: VacancyPatch, request: Request,
                         user: User = Depends(require_roles(EMPLOYER)), db: AsyncSession = Depends(get_db)):
    v = await _own_vacancy(db, user, vacancy_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="Holat faqat open yoki closed bo‘lishi mumkin")
    for key, value in data.items():
        setattr(v, key, value)
    audit.record(db, actor_id=user.id, action="vacancy.update", entity="vacancy", entity_id=v.id, after=data, ip=client_ip(request))
    await db.commit()
    return _vacancy_row(v, (await _role_names(db)).get(v.career_profile_id))


@router.get("/me/vacancies/{vacancy_id}/candidates")
async def vacancy_candidates(vacancy_id: uuid.UUID, limit: int = 20, user: User = Depends(require_roles(EMPLOYER)),
                             db: AsyncSession = Depends(get_db)):
    """Consenting students ranked by fit to the vacancy's profession."""
    from app.api.v1.endpoints.career import _candidate_summary, _consenting_students, _skill_states
    v = await _own_vacancy(db, user, vacancy_id)
    prof = (await db.execute(select(CareerProfile).where(CareerProfile.id == v.career_profile_id))).scalars().first()
    reqs = career.parse_requirements(prof.requirements) if prof else []
    out = []
    for st in await _consenting_students(db):
        states, _, _ = await _skill_states(db, st.id)
        if not states:
            continue
        hard = career.match(reqs, states)
        out.append({**await _candidate_summary(db, st), "matchPct": hard.match_pct, "readiness": career.readiness(reqs, states),
                    "missing_must": hard.missing_must})
    out.sort(key=lambda c: (c["matchPct"] is None, -(c["matchPct"] or 0), -c["readiness"]))
    return {"vacancy": _vacancy_row(v, prof.role_name if prof else None), "candidates": out[:max(1, min(limit, 100))]}


class PlanIn(BaseModel):
    tier: str


@router.put("/{company_id}/plan")
async def set_plan(company_id: uuid.UUID, payload: PlanIn, request: Request, user: User = Depends(require_roles(SUPER_ADMIN)),
                   db: AsyncSession = Depends(get_db)):
    """Super admin switches a company's tier after payment is agreed outside the platform."""
    if payload.tier not in companies.PLANS:
        raise HTTPException(status_code=400, detail="Noma’lum tarif")
    org = await _company(db, company_id)
    plan = await _plan(db, org.id)
    plan.tier = payload.tier
    audit.record(db, actor_id=user.id, action="company.plan", entity="employer_plan", entity_id=plan.id,
                 after={"company": org.name, "tier": payload.tier}, ip=client_ip(request))
    await db.commit()
    return companies.plan_view(plan.tier, plan.period_start, plan.credits_used, datetime.now(timezone.utc))
