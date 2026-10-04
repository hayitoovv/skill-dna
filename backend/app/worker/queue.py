"""Job queue (section 3.1: heavy or risky work — code execution, LLM grading, recomputation — runs in workers).

With REDIS_URL set, jobs go to the arq worker (`arq app.worker.main.WorkerSettings`), which can run on
a separate host next to the code sandbox (section 3.5). Without Redis (local development) the same job
functions run as background tasks inside the API process, so behaviour is identical either way.
"""
import asyncio
import logging
from typing import Any, Optional, Set

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool = None
_inline_tasks: Set[asyncio.Task] = set()


async def _redis_pool():
    global _pool
    if _pool is None:
        from arq import create_pool
        from arq.connections import RedisSettings

        _pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    return _pool


async def _run_inline(name: str, *args: Any) -> None:
    from app.worker import jobs

    try:
        await getattr(jobs, name)({}, *args)
    except Exception:  # a failed job must not take the API down; it is logged for the operator
        logger.exception("Inline job %s failed", name)


async def enqueue(name: str, *args: Any) -> Optional[str]:
    """Queues a job by name (functions in app.worker.jobs). Returns the arq job id when using Redis."""
    if settings.REDIS_URL:
        try:
            job = await (await _redis_pool()).enqueue_job(name, *args)
            return job.job_id if job else None
        except Exception:
            logger.exception("Redis enqueue failed; running %s inline", name)
    task = asyncio.create_task(_run_inline(name, *args))
    _inline_tasks.add(task)  # keep a reference so the task isn't garbage-collected mid-run
    task.add_done_callback(_inline_tasks.discard)
    return None
