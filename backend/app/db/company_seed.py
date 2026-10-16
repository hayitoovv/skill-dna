"""Sample companies, vacancies and hiring statistics for demos.

Every row is marked as sample data (`settings.demo = true`, notes start with "Namuna") and the UI labels it
"namuna": the figures are illustrative, not the companies' real numbers. Editing a company's profile through
the platform drops the flag. Idempotent: an existing company with the same name is left alone.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CareerProfile, HiringStat, Organization, Scholarship, Skill, SponsoredChallenge, Task, User, Vacancy

SAMPLE_COMPANIES = [
    {
        "name": "Artel Electronics",
        "settings": {"industry": "Elektronika va maishiy texnika", "region": "Toshkent", "website": "https://artelgroup.com", "demo": True},
        "vacancies": [
            ("Junior Backend dasturchi", "Backend Developer", 3, "full_time"),
            ("Embedded dasturchi (stajyor)", "Embedded Engineer", 2, "internship"),
            ("Data Analyst", "Data Analyst", 1, "full_time"),
        ],
        "hires": [(1, 18), (2, 12)],  # (years ago, hired) from the first university
    },
    {
        "name": "EPAM Uzbekistan",
        "settings": {"industry": "Dasturiy ta’minot ishlab chiqish", "region": "Toshkent", "website": "https://www.epam.com", "demo": True},
        "vacancies": [
            ("Junior Python Developer", "Backend Developer", 5, "full_time"),
            ("QA Automation (stajyor)", "QA Engineer", 3, "internship"),
            ("Junior DevOps Engineer", "DevOps Engineer", 2, "full_time"),
        ],
        "hires": [(1, 25), (2, 20)],
    },
]


async def seed_sample_companies(db: AsyncSession) -> dict:
    stats = {"companies": 0, "vacancies": 0}
    # The university with the most users (the one demo students belong to)
    university = (await db.execute(
        select(Organization).outerjoin(User, User.org_id == Organization.id).where(Organization.type == "university")
        .group_by(Organization.id).order_by(func.count(User.id).desc())
    )).scalars().first()
    careers = {p.role_name: p for p in (await db.execute(select(CareerProfile))).scalars().all()}
    year = datetime.now(timezone.utc).year
    for spec in SAMPLE_COMPANIES:
        if (await db.execute(select(Organization).where(Organization.name == spec["name"]))).scalars().first():
            continue
        org = Organization(name=spec["name"], type="company", settings=spec["settings"])
        db.add(org)
        await db.flush()
        stats["companies"] += 1
        for title, role, openings, kind in spec["vacancies"]:
            prof = careers.get(role)
            if not prof:
                continue
            db.add(Vacancy(org_id=org.id, career_profile_id=prof.id, title=title, openings=openings,
                           employment_type=kind, city="Toshkent", status="open"))
            stats["vacancies"] += 1
        if university:
            for years_ago, hired in spec["hires"]:
                db.add(HiringStat(company_org_id=org.id, university_org_id=university.id, year=year - years_ago,
                                  hired_count=hired, note="Namuna ma’lumot"))
    return stats


async def seed_sample_sponsorships(db: AsyncSession) -> dict:
    """One sample challenge (EPAM) and one sample scholarship (Artel), marked as sample data."""
    stats = {"challenges": 0, "scholarships": 0}
    orgs = {o.name: o for o in (await db.execute(select(Organization).where(Organization.type == "company"))).scalars().all()}
    university = (await db.execute(
        select(Organization).outerjoin(User, User.org_id == Organization.id).where(Organization.type == "university")
        .group_by(Organization.id).order_by(func.count(User.id).desc())
    )).scalars().first()
    now = datetime.now(timezone.utc)
    epam, artel = orgs.get("EPAM Uzbekistan"), orgs.get("Artel Electronics")
    if epam and not (await db.execute(select(SponsoredChallenge).where(SponsoredChallenge.org_id == epam.id))).scalars().first():
        tasks = (await db.execute(select(Task.id).join(Skill, Skill.id == Task.skill_id)
                                  .where(Skill.code.in_(["SE-BACKEND", "SE-SQL"]), Task.status == "active").limit(4))).scalars().all()
        if tasks:
            db.add(SponsoredChallenge(org_id=epam.id, title="Backend Challenge", task_ids=[str(t) for t in tasks],
                                      description="Namuna tanlov: backend va SQL topshiriqlari. Eng yaxshi natija ko‘rsatganlar suhbatga taklif qilinadi.",
                                      prize_note="Top-5 ga amaliyot suhbati (namuna)", starts_at=now - timedelta(days=60),
                                      ends_at=now + timedelta(days=30)))
            stats["challenges"] += 1
    if artel and university and not (await db.execute(select(Scholarship).where(Scholarship.org_id == artel.id))).scalars().first():
        db.add(Scholarship(org_id=artel.id, university_org_id=university.id, title="Artel stipendiyasi", slots=3,
                           amount_note="[summa korxona bilan kelishiladi]",
                           description="Namuna stipendiya: universitet reytingidagi eng yuqori natijali talabalar uchun.",
                           deadline=now + timedelta(days=45)))
        stats["scholarships"] += 1
    return stats
