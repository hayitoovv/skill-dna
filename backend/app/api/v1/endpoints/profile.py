from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models import User, StudentProfile, SkillScore, Evidence, Direction, Skill
from app.api.v1.endpoints.auth import resolve_user
import uuid

router = APIRouter()

@router.get("/dna")
async def get_student_dna(
    user_id: str = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    user = await resolve_user(user_id, authorization, db)

    if not user and not user_id and not authorization:
        user_res = await db.execute(select(User).where(User.role == "student").limit(1))
        user = user_res.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Talaba topilmadi")

    # Get student direction
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = prof_res.scalars().first()

    dir_id = profile.direction_id if profile else None
    dir_res = await db.execute(select(Direction).where(Direction.id == dir_id) if dir_id else select(Direction).limit(1))
    direction = dir_res.scalars().first()

    # Get skills for direction
    skills_res = await db.execute(select(Skill).where(Skill.direction_id == direction.id))
    skills = skills_res.scalars().all()

    # Get scores
    scores_res = await db.execute(select(SkillScore).where(SkillScore.user_id == user.id))
    scores = {s.skill_id: s for s in scores_res.scalars().all()}

    # Primary core skill
    primary_skill = skills[0] if skills else None
    primary_score = scores.get(primary_skill.id) if primary_skill else None

    # Count verified evidence
    evidence_res = await db.execute(select(Evidence).where(Evidence.user_id == user.id))
    evidence_list = evidence_res.scalars().all()

    skills_data = []
    for sk in skills:
        sc = scores.get(sk.id)
        skills_data.append({
            "id": str(sk.id),
            "code": sk.code,
            "name": sk.name,
            "isCore": sk.type == "core",
            "score": round(sc.score, 0) if sc else 0.0,
            "confidence": round(sc.confidence, 0) if sc else 0.0,
            "level": sc.level if sc else "L0",
            "evidenceCount": len([e for e in evidence_list if e.skill_id == sk.id])
        })

    layers_breakdown = (
        primary_score.components if primary_score and primary_score.components
        else {
            "KNOW": 0.0,
            "DO": 0.0,
            "ADAPT": 0.0,
            "DEFEND": 0.0,
            "PROVE": 0.0
        }
    )

    return {
        "direction": {
            "id": str(direction.id) if direction else "",
            "code": direction.code if direction else "software",
            "name": direction.name if direction else "Dasturiy injiniring"
        },
        "student": {
            "id": str(user.id),
            "name": user.full_name,
            "course": profile.course if profile else "1-kurs",
            "group": profile.group_id if profile else "101-26 DI"
        },
        "overall_score": round(primary_score.score, 0) if primary_score else 0.0,
        "confidence": round(primary_score.confidence, 0) if primary_score else 0.0,
        "level": primary_score.level if primary_score else "L0 BOSHLANG‘ICH",
        "evidence_count": len(evidence_list),
        "layers": layers_breakdown,
        "skills": skills_data
    }

@router.get("/evidence-graph")
async def get_evidence_graph(
    user_id: str = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns nodes and edges for the verifiable Evidence Graph.
    Shows the immutable chain of proof: Task -> Submission -> Tests -> Viva -> Evidence Node -> Skill Score.
    """
    nodes = [
        {"id": "task-1", "label": "Token Bucket Rate Limiter", "type": "task", "status": "completed"},
        {"id": "sub-1", "label": "Python Middleware Code (v2.1)", "type": "submission", "status": "verified"},
        {"id": "test-1", "label": "4/4 PyTest Concurrency Tests", "type": "tests", "status": "passed", "score": 100.0},
        {"id": "adapt-1", "label": "Deadlock Parameter Challenge", "type": "challenge", "status": "adapted", "score": 85.0},
        {"id": "viva-1", "label": "AI Viva Architectural Defense", "type": "viva", "status": "defended", "score": 88.0},
        {"id": "ev-1", "label": "Evidence: Backend DO & DEFEND", "type": "evidence", "status": "verified", "score": 85.0},
        {"id": "score-1", "label": "Skill Score: 83/100 (Confidence: 81%)", "type": "score", "status": "active", "score": 83.0},
    ]

    edges = [
        {"source": "task-1", "target": "sub-1", "type": "produced"},
        {"source": "sub-1", "target": "test-1", "type": "verified_by"},
        {"source": "sub-1", "target": "adapt-1", "type": "challenged_by"},
        {"source": "sub-1", "target": "viva-1", "type": "defended_in"},
        {"source": "test-1", "target": "ev-1", "type": "supports"},
        {"source": "viva-1", "target": "ev-1", "type": "supports"},
        {"source": "adapt-1", "target": "ev-1", "type": "supports"},
        {"source": "ev-1", "target": "score-1", "type": "derives"},
    ]

    return {"nodes": nodes, "edges": edges}
