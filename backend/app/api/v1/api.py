from fastapi import APIRouter
from app.api.v1.endpoints import auth, ontology, tasks, viva, profile, career

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Roles"])
api_router.include_router(ontology.router, tags=["Competency Ontology"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Assessment Tasks & Sandbox"])
api_router.include_router(viva.router, prefix="/viva", tags=["AI Viva (DEFEND)"])
api_router.include_router(profile.router, prefix="/profile", tags=["Skill DNA & Evidence Graph"])
api_router.include_router(career.router, prefix="/career", tags=["Career DNA & AI Coach"])
