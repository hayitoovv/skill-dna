"""Failed-attempt limits for login and the second factor (brute-force protection).

Counters live in Redis when REDIS_URL is set (shared by all API workers); otherwise in this process's memory,
which is enough for local development. A Redis outage never blocks a login: the in-memory counter takes over.
"""
import logging
import time
from typing import Dict, List

from app.core.config import settings

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 15 * 60
_memory: Dict[str, List[float]] = {}


async def _redis():
    from app.worker.queue import _redis_pool  # the arq pool is a redis.asyncio client

    return await _redis_pool()


def _memory_hits(key: str) -> List[float]:
    now = time.monotonic()
    hits = [t for t in _memory.get(key, []) if now - t < WINDOW_SECONDS]
    _memory[key] = hits
    return hits


async def failures(key: str) -> int:
    if settings.REDIS_URL:
        try:
            value = await (await _redis()).get(f"rl:{key}")
            return int(value or 0)
        except Exception:
            logger.warning("Rate limit read failed for %s; using memory", key)
    return len(_memory_hits(key))


async def record_failure(key: str) -> None:
    if settings.REDIS_URL:
        try:
            redis = await _redis()
            count = await redis.incr(f"rl:{key}")
            if count == 1:
                await redis.expire(f"rl:{key}", WINDOW_SECONDS)
            return
        except Exception:
            logger.warning("Rate limit write failed for %s; using memory", key)
    _memory_hits(key).append(time.monotonic())


async def reset(key: str) -> None:
    _memory.pop(key, None)
    if settings.REDIS_URL:
        try:
            await (await _redis()).delete(f"rl:{key}")
        except Exception:
            logger.warning("Rate limit reset failed for %s", key)
