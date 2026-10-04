"""arq worker entry point: `arq app.worker.main.WorkerSettings` (requires REDIS_URL)."""
from arq.connections import RedisSettings

from app.core.config import settings
from app.worker import jobs


class WorkerSettings:
    functions = [jobs.evaluate_code, jobs.grade_viva, jobs.recompute_scores]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL or "redis://localhost:6379/0")
    max_jobs = 4
    job_timeout = 300  # sandbox + up to 3 LLM grader calls
    keep_result = 3600
