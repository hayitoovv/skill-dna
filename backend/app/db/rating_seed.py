"""Sample students for the rating, until real students fill it.

Every sample student has an `@namuna.skilldna.uz` email, a random unusable password and opted into the public
rating. Their scores come from Evidence rows, so recompute_all() rebuilds them like any real student's.
Idempotent: an existing email is left alone.

Remove them: set SAMPLE_STUDENTS_ENABLED=false in .env and run update.sh, or
Run: python -m app.db.rating_seed --remove
"""
import asyncio
import random
import secrets
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models import (
    Consent, Direction, Evidence, IntegrityFlag, Organization, Skill, SkillScore, StudentProfile, User, UserRole,
)

SAMPLE_DOMAIN = "namuna.skilldna.uz"
LAYERS = ["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"]

# (full name, direction code, group)
SAMPLE_STUDENTS = [
    ("Jasur Karimov", "software", "941-21 DI"),
    ("Malika Yusupova", "software", "941-21 DI"),
    ("Sardor Rahimov", "software", "941-21 DI"),
    ("Dilnoza Tursunova", "software", "941-21 DI"),
    ("Bekzod Aliyev", "software", "941-21 DI"),
    ("Nodira Xolmatova", "software", "941-21 DI"),
    ("Otabek Nazarov", "software", "942-21 DI"),
    ("Kamola Ergasheva", "software", "942-21 DI"),
    ("Javohir Qodirov", "software", "942-21 DI"),
    ("Madina Saidova", "software", "942-21 DI"),
    ("Ulug‘bek Hasanov", "software", "942-21 DI"),
    ("Shahnoza Abdullayeva", "software", "942-21 DI"),
    ("Doston Mirzaaliyev", "ai", "951-21 SI"),
    ("Gulnora Rashidova", "ai", "951-21 SI"),
    ("Abdulaziz To‘xtayev", "ai", "951-21 SI"),
    ("Zarina Islomova", "ai", "951-21 SI"),
    ("Elyor Sultonov", "computer", "961-21 KI"),
    ("Feruza Normatova", "computer", "961-21 KI"),
    ("Islom Jo‘rayev", "computer", "961-21 KI"),
    ("Sevara Usmonova", "computer", "961-21 KI"),
]


def _email(name: str, org: Organization) -> str:
    slug = "".join(ch for ch in name.lower().replace(" ", ".") if ch.isascii() and (ch.isalnum() or ch == "."))
    return f"{slug}.{str(org.id)[:6]}@{SAMPLE_DOMAIN}"


async def seed_sample_students(db: AsyncSession) -> dict:
    stats = {"students": 0, "evidence": 0}
    universities = (await db.execute(select(Organization).where(Organization.type == "university"))).scalars().all()
    directions = {d.code: d for d in (await db.execute(select(Direction))).scalars().all()}
    core: Dict[str, List[Skill]] = {}
    for sk in (await db.execute(select(Skill).where(Skill.is_deleted.is_(False), Skill.type == "core"))).scalars().all():
        core.setdefault(str(sk.direction_id), []).append(sk)
    pwd_hash = get_password_hash(secrets.token_urlsafe(32))  # nobody can log in as a sample student
    now = datetime.now(timezone.utc)

    for org in universities:
        for name, dir_code, group in SAMPLE_STUDENTS:
            direction = directions.get(dir_code)
            skills = sorted(core.get(str(direction.id), []), key=lambda s: s.code) if direction else []
            email = _email(name, org)
            if not skills or (await db.execute(select(User.id).where(User.email == email))).first():
                continue
            user = User(full_name=name, email=email, hashed_password=pwd_hash, role=UserRole.STUDENT.value,
                        org_id=org.id, status="active", locale="uz")
            db.add(user)
            await db.flush()
            db.add(StudentProfile(user_id=user.id, direction_id=direction.id, course="3-kurs", group_id=group, cohort="2021-2025"))
            db.add(Consent(user_id=user.id, type="rating_public", granted_at=now))
            stats["students"] += 1

            # Same name + university gives the same numbers on every run
            rnd = random.Random(email)
            covered = rnd.sample(skills, rnd.randint(1, len(skills)))
            base = rnd.uniform(40, 92)
            for sk in covered:
                skill_base = min(100.0, max(20.0, base + rnd.uniform(-10, 10)))
                for i, layer in enumerate(LAYERS):
                    # Layers stay within ±8 of each other, far from the CROSS_LAYER_GAP flag threshold
                    db.add(Evidence(user_id=user.id, skill_id=sk.id, layer=layer, title=f"Namuna: {sk.name} ({layer})",
                                    score=round(min(100.0, max(0.0, skill_base + rnd.uniform(-8, 8))), 1),
                                    status="verified", verified_by="automated",
                                    created_at=now - timedelta(days=rnd.randint(1, 60), minutes=i)))
                    stats["evidence"] += 1
    await db.commit()
    return stats


async def remove_sample_students(db: AsyncSession) -> int:
    ids = (await db.execute(select(User.id).where(User.email.like(f"%@{SAMPLE_DOMAIN}")))).scalars().all()
    if not ids:
        return 0
    for model in (SkillScore, Evidence, IntegrityFlag, Consent, StudentProfile):
        await db.execute(delete(model).where(model.user_id.in_(ids)))
    await db.execute(delete(User).where(User.id.in_(ids)))
    await db.commit()
    return len(ids)


async def main() -> None:
    from app.core.database import AsyncSessionLocal
    from app.db.recompute_scores import recompute_all

    async with AsyncSessionLocal() as db:
        if "--remove" in sys.argv:
            print("Removed sample students:", await remove_sample_students(db))
            return
        print("Sample students:", await seed_sample_students(db))
    print("Recomputed scores:", await recompute_all())


if __name__ == "__main__":
    asyncio.run(main())
