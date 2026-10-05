"""API v1 routes — architecture document v2.0, section 12."""
from fastapi import APIRouter

from app.api.v1.endpoints import admin, assistant, auth, career, credentials, notifications, ontology, profile, staff, tasks, viva

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth, roles & consent"])
api_router.include_router(ontology.router, tags=["Competency Ontology"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Assessment"])
api_router.include_router(tasks.challenge_router, tags=["ADAPT challenges"])
api_router.include_router(viva.router, prefix="/viva", tags=["AI Viva (DEFEND)"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["AI assistant (AI-assisted mode)"])
api_router.include_router(profile.router, prefix="/profile", tags=["Skill DNA & Evidence Graph"])
api_router.include_router(profile.skills_router, tags=["Skill DNA & Evidence Graph"])
api_router.include_router(career.router, prefix="/careers", tags=["Career DNA & AI Coach"])
api_router.include_router(career.legacy_router, prefix="/career", tags=["Career DNA & AI Coach"])
api_router.include_router(career.employer_router, prefix="/employer", tags=["Employer"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(admin.public_router, tags=["Site content"])
api_router.include_router(admin.router, prefix="/admin", tags=["Super admin"])
api_router.include_router(staff.moderation_router, prefix="/moderation", tags=["Moderation (Integrity)"])
api_router.include_router(staff.appeals_router, prefix="/appeals", tags=["Appeals"])
api_router.include_router(staff.teacher_router, prefix="/teacher", tags=["Teacher"])
api_router.include_router(staff.university_router, prefix="/university", tags=["University analytics"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["Credentials (OB 3.0)"])
api_router.include_router(credentials.public_router, tags=["Credentials (OB 3.0)"])
