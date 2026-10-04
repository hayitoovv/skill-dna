from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.api.v1.endpoints.credentials import did_document

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

# did:web resolution needs the issuer document at the domain root (section 14)
app.add_api_route("/.well-known/did.json", did_document, methods=["GET"], tags=["Credentials (OB 3.0)"])

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "platform": "SKILL DNA",
        "version": "2.0.0",
        "database": "PostgreSQL (skill_dna)",
        "llm": "enabled" if settings.ANTHROPIC_API_KEY else "deterministic fallback",
    }

@app.get("/", tags=["System"])
async def root():
    return {
        "message": "SKILL DNA — AI Talent Intelligence Platform API",
        "docs": "/docs",
        "version": "2.0.0"
    }
