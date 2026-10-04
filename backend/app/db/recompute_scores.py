"""Recompute every skill score from evidence (section 4: when formula_version changes, all scores are rebuilt).

Run: python -m app.db.recompute_scores
"""
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import Evidence, SkillScore
from app.services import skill_service
from app.services.scoring_engine import FORMULA_VERSION


async def recompute_all() -> int:
    async with AsyncSessionLocal() as db:
        pairs = set((await db.execute(select(Evidence.user_id, Evidence.skill_id).distinct())).all())
        # Also rebuild skills that only have a legacy score row, so stale numbers don't survive
        pairs |= set((await db.execute(select(SkillScore.user_id, SkillScore.skill_id).distinct())).all())
        for user_id, skill_id in pairs:
            await skill_service.recompute(db, user_id, skill_id)
        await db.commit()
    return len(pairs)


async def main() -> None:
    n = await recompute_all()
    print(f"Recomputed {n} skill scores with formula {FORMULA_VERSION}")


if __name__ == "__main__":
    asyncio.run(main())
