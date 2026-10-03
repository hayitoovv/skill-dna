from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "SKILL DNA — AI Talent Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "skilldna-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "root123"
    POSTGRES_DB: str = "skill_dna"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:root123@localhost:5432/skill_dna"
    SYNC_DATABASE_URL: str = "postgresql://postgres:root123@localhost:5432/skill_dna"

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8443",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8443",
        "*",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
