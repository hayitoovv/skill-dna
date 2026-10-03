from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models import Direction, Skill, Rubric
from app.schemas.ontology import DirectionItem, SkillItem
from typing import List
import uuid

router = APIRouter()

@router.get("/directions")
async def get_directions(db: AsyncSession = Depends(get_db)):
    query = select(Direction).options(selectinload(Direction.skills))
    result = await db.execute(query)
    directions = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "code": d.code,
            "name": d.name,
            "description": d.description,
            "skills": [
                {
                    "id": str(s.id),
                    "code": s.code,
                    "name": s.name,
                    "type": s.type,
                    "framework_refs": s.framework_refs,
                }
                for s in d.skills
            ]
        }
        for d in directions
    ]

@router.get("/skills/{skill_id}")
async def get_skill_detail(skill_id: str, db: AsyncSession = Depends(get_db)):
    try:
        sid = uuid.UUID(skill_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri Skill ID formati")

    query = select(Skill).where(Skill.id == sid).options(selectinload(Skill.rubrics))
    result = await db.execute(query)
    skill = result.scalars().first()

    if not skill:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")

    return {
        "id": str(skill.id),
        "code": skill.code,
        "name": skill.name,
        "type": skill.type,
        "rubrics": [
            {
                "level": r.level,
                "level_name": r.level_name,
                "criteria": r.criteria,
            }
            for r in skill.rubrics
        ]
    }
