"""Background jobs. Signature `(ctx, *args)` works both for arq and for inline execution."""
import uuid

from app.core.database import AsyncSessionLocal
from app.services import evaluation


async def evaluate_code(ctx, attempt_id: str) -> dict:
    """Runs the sandbox for a queued DO/ADAPT code submission and records the result."""
    async with AsyncSessionLocal() as db:
        return await evaluation.evaluate_code(db, uuid.UUID(attempt_id))


async def grade_viva(ctx, session_id: str) -> dict:
    """Grades a finished viva with the 2–3 grader panel and records evidence, flags and the new score."""
    from app.api.v1.endpoints.viva import grade_finished_session  # imported lazily: avoids an import cycle

    async with AsyncSessionLocal() as db:
        return await grade_finished_session(db, uuid.UUID(session_id))


async def recompute_scores(ctx) -> int:
    from app.db.recompute_scores import recompute_all

    return await recompute_all()
