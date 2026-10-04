"""Competency ontology: directions, skills, rubrics and their admin editor (sections 3.3, 9, 12 "Ontologiya").

Directions, skills and rubrics are data, not code: adding a direction never needs a deploy.
Edits are versioned (version bump) and audited.
"""
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import MODERATOR, SUPER_ADMIN, client_ip, require_roles
from app.core.database import get_db
from app.models import AuditLog, Direction, Rubric, Skill, User
from app.services import audit

router = APIRouter()


def _skill(s: Skill) -> dict:
    return {"id": str(s.id), "code": s.code, "name": s.name, "type": s.type, "parent_id": str(s.parent_id) if s.parent_id else None,
            "framework_refs": s.framework_refs, "version": s.version, "pilot": bool((s.framework_refs or {}).get("pilot"))}


@router.get("/directions")
async def get_directions(db: AsyncSession = Depends(get_db)):
    directions = (await db.execute(select(Direction).options(selectinload(Direction.skills)))).scalars().all()
    return [
        {"id": str(d.id), "code": d.code, "name": d.name, "description": d.description, "version": d.version,
         "skills": [_skill(s) for s in d.skills if not s.is_deleted]}
        for d in directions
    ]


@router.get("/skills")
async def list_skills(direction: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(Skill).where(Skill.is_deleted.is_(False))
    if direction:
        q = q.join(Direction, Direction.id == Skill.direction_id).where(Direction.code == direction)
    return [_skill(s) for s in (await db.execute(q)).scalars().all()]


async def _get_skill(db: AsyncSession, skill_id: str) -> Skill:
    try:
        sid = uuid.UUID(skill_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri Skill ID formati")
    skill = (await db.execute(select(Skill).where(Skill.id == sid).options(selectinload(Skill.rubrics)))).scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")
    return skill


def _rubrics(skill: Skill):
    return [{"level": r.level, "level_name": r.level_name, "criteria": r.criteria, "version": r.version}
            for r in sorted(skill.rubrics, key=lambda r: r.level) if not r.is_deleted]


@router.get("/skills/{skill_id}")
async def get_skill_detail(skill_id: str, db: AsyncSession = Depends(get_db)):
    skill = await _get_skill(db, skill_id)
    return {**_skill(skill), "rubrics": _rubrics(skill)}


@router.get("/skills/{skill_id}/rubric")
async def get_rubric(skill_id: str, db: AsyncSession = Depends(get_db)):
    return _rubrics(await _get_skill(db, skill_id))


def _bump(version: Optional[str]) -> str:
    try:
        major, minor = (version or "1.0").split(".")[:2]
        return f"{major}.{int(minor) + 1}"
    except ValueError:
        return "1.1"


class SkillCreate(BaseModel):
    direction_code: str
    code: str
    name: str
    type: str = Field(default="core", description="core | sub | cross")
    parent_code: Optional[str] = None
    framework_refs: Dict[str, Any] = {}


@router.post("/skills")
async def create_skill(payload: SkillCreate, request: Request, actor: User = Depends(require_roles(MODERATOR)),
                       db: AsyncSession = Depends(get_db)):
    direction = (await db.execute(select(Direction).where(Direction.code == payload.direction_code))).scalars().first()
    if not direction:
        raise HTTPException(status_code=404, detail="Yo‘nalish topilmadi")
    if (await db.execute(select(Skill).where(Skill.code == payload.code))).scalars().first():
        raise HTTPException(status_code=400, detail="Bu kod bilan ko‘nikma mavjud")
    parent = None
    if payload.parent_code:
        parent = (await db.execute(select(Skill).where(Skill.code == payload.parent_code))).scalars().first()
    skill = Skill(direction_id=direction.id, parent_id=parent.id if parent else None, code=payload.code, name=payload.name,
                  type=payload.type, framework_refs=payload.framework_refs, version="1.0")
    db.add(skill)
    audit.record(db, actor_id=actor.id, action="ontology.skill_create", entity="skill", entity_id=payload.code,
                 after=payload.model_dump(), ip=client_ip(request))
    await db.commit()
    return _skill(skill)


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    framework_refs: Optional[Dict[str, Any]] = None


@router.put("/skills/{skill_id}")
async def update_skill(skill_id: str, payload: SkillUpdate, request: Request, actor: User = Depends(require_roles(MODERATOR)),
                       db: AsyncSession = Depends(get_db)):
    skill = await _get_skill(db, skill_id)
    before = _skill(skill)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(skill, field, value)
    skill.version = _bump(skill.version)
    audit.record(db, actor_id=actor.id, action="ontology.skill_update", entity="skill", entity_id=skill.id,
                 before=before, after=_skill(skill), ip=client_ip(request))
    await db.commit()
    return _skill(skill)


class RubricUpsert(BaseModel):
    skill_id: uuid.UUID
    level: int = Field(ge=1, le=5)
    level_name: str
    criteria: Dict[str, Any]


@router.post("/rubrics")
async def upsert_rubric(payload: RubricUpsert, request: Request, actor: User = Depends(require_roles(MODERATOR)),
                        db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(Rubric).where(Rubric.skill_id == payload.skill_id, Rubric.level == payload.level,
                                              Rubric.is_deleted.is_(False)))
    ).scalars().first()
    before = {"criteria": existing.criteria, "version": existing.version} if existing else None
    if existing:
        existing.level_name, existing.criteria, existing.version = payload.level_name, payload.criteria, _bump(existing.version)
        rubric = existing
    else:
        rubric = Rubric(skill_id=payload.skill_id, level=payload.level, level_name=payload.level_name,
                        criteria=payload.criteria, version="1.0")
        db.add(rubric)
    audit.record(db, actor_id=actor.id, action="ontology.rubric_upsert", entity="rubric", entity_id=f"{payload.skill_id}:L{payload.level}",
                 before=before, after={"criteria": payload.criteria}, ip=client_ip(request))
    await db.commit()
    return {"skill_id": str(rubric.skill_id), "level": rubric.level, "version": rubric.version}


@router.get("/audit")
async def audit_log(limit: int = 100, entity: Optional[str] = None,
                    actor: User = Depends(require_roles(MODERATOR, SUPER_ADMIN)), db: AsyncSession = Depends(get_db)):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 500))
    if entity:
        q = q.where(AuditLog.entity == entity)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": str(a.id), "actor_id": str(a.actor_id) if a.actor_id else None, "action": a.action, "entity": a.entity,
             "entity_id": a.entity_id, "before": a.payload_before, "after": a.payload_after, "ip": a.ip_address,
             "ts": a.created_at.isoformat()} for a in rows]
