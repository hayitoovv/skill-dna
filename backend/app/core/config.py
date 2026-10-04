import logging
import secrets
from pydantic_settings import BaseSettings
from typing import List

logger = logging.getLogger(__name__)

_DEV_SECRET = "skilldna-super-secret-key-change-in-production-2026"


class Settings(BaseSettings):
    PROJECT_NAME: str = "SKILL DNA — AI Talent Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | staging | production

    # Auth (section 13.1: short-lived access token + refresh token)
    SECRET_KEY: str = _DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    # Two-factor auth for privileged roles (section 13.1). Enforced in production.
    MFA_ENFORCED: bool = False
    MFA_REQUIRED_ROLES: List[str] = ["moderator", "university", "super_admin"]

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "root123"
    POSTGRES_DB: str = "skill_dna"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:root123@localhost:5432/skill_dna"
    SYNC_DATABASE_URL: str = "postgresql://postgres:root123@localhost:5432/skill_dna"

    # Explicit origins only: credentials are allowed, so a "*" wildcard is unsafe
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8443",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8443",
    ]

    # AI layer (section 3.2: provider abstraction). Without a key the
    # deterministic rubric graders are used instead of an LLM.
    # LLM_PROVIDER: "anthropic" | "gemini" | "" (auto: whichever key is set, Anthropic first).
    LLM_PROVIDER: str = ""
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "claude-opus-5-5"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    LLM_MAX_TOKENS: int = 16000
    VIVA_GRADER_COUNT: int = 3

    # Job queue (section 3.1). Empty = jobs run as background tasks inside the API process.
    REDIS_URL: str = ""

    # Code sandbox (section 5.5): student code only ever runs in a disposable container
    SANDBOX_ENABLED: bool = True
    SANDBOX_DOCKER_BIN: str = "docker"
    SANDBOX_PYTHON_IMAGE: str = "python:3.12-alpine"
    SANDBOX_TIMEOUT_SECONDS: int = 10
    SANDBOX_MEMORY_MB: int = 256

    # ADAPT variants are derived from a secret salt so they're reproducible but unguessable
    CHALLENGE_SALT: str = ""

    # Open Badges 3.0 / W3C VC issuer (section 14)
    CREDENTIAL_ISSUER_DID: str = "did:web:skilldna.uz"
    CREDENTIAL_ISSUER_NAME: str = "SKILL DNA"
    CREDENTIAL_VERIFY_BASE_URL: str = "https://skilldna.uz/verify"
    CREDENTIAL_SIGNING_KEY_PATH: str = "credential_signing_key.pem"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

if settings.SECRET_KEY == _DEV_SECRET:
    if settings.ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY must be set via environment in production")
    logger.warning("Using the built-in development SECRET_KEY; set SECRET_KEY in .env")

if not settings.CHALLENGE_SALT:
    if settings.ENVIRONMENT == "production":
        raise RuntimeError("CHALLENGE_SALT must be set via environment in production")
    # Stable per-process fallback for development only
    settings.CHALLENGE_SALT = secrets.token_hex(16)
