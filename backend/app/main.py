from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI davrida insonning real kasbiy kompetensiyasini aniqlash, isbotlash, rivojlantirish va ish bilan bog‘lash platformasi API",
    version="2.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "platform": "SKILL DNA",
        "version": "2.0.0",
        "database": "PostgreSQL (skill_dna)",
    }

@app.get("/", tags=["System"])
async def root():
    return {
        "message": "SKILL DNA — AI Talent Intelligence Platform API",
        "docs": "/docs",
        "version": "2.0.0"
    }
