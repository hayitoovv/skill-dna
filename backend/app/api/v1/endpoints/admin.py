"""Super admin: site text overrides (CMS), user management and platform overview."""
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SUPER_ADMIN, client_ip, require_roles
from app.core.database import get_db
from app.models import (Attempt, AuditLog, Credential, EmployerInvite, Evidence, IntegrityFlag, SiteText, Task, User)
from app.services import audit

public_router = APIRouter()
router = APIRouter()

ROLES = ("student", "teacher", "employer", "university", "moderator", "super_admin")
STATUSES = ("active", "blocked")


def _norm(text: str) -> str:
    return " ".join((text or "").split())


def _hash(source: str) -> str:
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Site texts (public read: the login page needs them before anyone signs in)
# ---------------------------------------------------------------------------

@public_router.get("/content")
async def site_content(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SiteText).order_by(SiteText.updated_at))).scalars().all()
    version = max((r.updated_at for r in rows), default=None)
    return {"version": version.isoformat() if version else None, "items": [{"source": r.source, "value": r.value} for r in rows]}


class TextOverride(BaseModel):
    source: str = Field(min_length=1, max_length=5000)
    value: str = Field(min_length=1, max_length=5000)


def _text_view(r: SiteText, editors: dict) -> dict:
    return {"id": str(r.id), "source": r.source, "value": r.value, "updated_at": r.updated_at.isoformat(),
            "updated_by": editors.get(r.updated_by)}


@router.get("/content")
async def list_texts(user: User = Depends(require_roles(SUPER_ADMIN)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SiteText).order_by(SiteText.updated_at.desc()))).scalars().all()
    ids = {r.updated_by for r in rows if r.updated_by}
    editors = {u.id: u.full_name for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return [_text_view(r, editors) for r in rows]


@router.put("/content")
async def save_text(payload: TextOverride, request: Request, user: User = Depends(require_roles(SUPER_ADMIN)),
                    db: AsyncSession = Depends(get_db)):
    source, value = _norm(payload.source), payload.value.strip()
    if not source or not value:
        raise HTTPException(status_code=400, detail="Matn bo‘sh bo‘lishi mumkin emas")
    row = (await db.execute(select(SiteText).where(SiteText.source_hash == _hash(source)))).scalars().first()
    before = row.value if row else None
    if row:
        row.value, row.updated_by = value, user.id
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = SiteText(source_hash=_hash(source), source=source, value=value, updated_by=user.id)
        db.add(row)
    await db.flush()
    audit.record(db, actor_id=user.id, action="content.update", entity="site_text", entity_id=row.id,
                 before={"value": before} if before is not None else None, after={"source": source, "value": value},
                 ip=client_ip(request))
    await db.commit()
    return _text_view(row, {user.id: user.full_name})


class TextRevert(BaseModel):
    source: str = Field(min_length=1, max_length=5000)


@router.post("/content/revert")
async def revert_text(payload: TextRevert, request: Request, user: User = Depends(require_roles(SUPER_ADMIN)),
                      db: AsyncSession = Depends(get_db)):
    """Back to the original wording (used by the in-page editor, which knows the text, not the row id)."""
    row = (await db.execute(select(SiteText).where(SiteText.source_hash == _hash(_norm(payload.source))))).scalars().first()
    if row:
        audit.record(db, actor_id=user.id, action="content.revert", entity="site_text", entity_id=row.id,
                     before={"source": row.source, "value": row.value}, ip=client_ip(request))
        await db.delete(row)
        await db.commit()
    return {"source": _norm(payload.source), "deleted": bool(row)}


@router.delete("/content/{text_id}")
async def delete_text(text_id: uuid.UUID, request: Request, user: User = Depends(require_roles(SUPER_ADMIN)),
                      db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(SiteText).where(SiteText.id == text_id))).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Matn topilmadi")
    audit.record(db, actor_id=user.id, action="content.revert", entity="site_text", entity_id=row.id,
                 before={"source": row.source, "value": row.value}, ip=client_ip(request))
    await db.delete(row)
    await db.commit()
    return {"id": str(text_id), "deleted": True}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def _user_view(u: User) -> dict:
    return {"id": str(u.id), "full_name": u.full_name, "email": u.email, "phone": u.phone or "", "role": u.role,
            "status": u.status, "created_at": u.created_at.isoformat()}


@router.get("/users")
async def list_users(q: Optional[str] = None, role: Optional[str] = None, limit: int = Query(200, ge=1, le=1000),
                     user: User = Depends(require_roles(SUPER_ADMIN)), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.is_deleted.is_(False))
    if role:
        stmt = stmt.where(User.role == role)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    rows = (await db.execute(stmt.order_by(User.created_at.desc()).limit(limit))).scalars().all()
    return [_user_view(u) for u in rows]


class UserUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


@router.put("/users/{user_id}")
async def update_user(user_id: uuid.UUID, payload: UserUpdate, request: Request,
                      actor: User = Depends(require_roles(SUPER_ADMIN)), db: AsyncSession = Depends(get_db)):
    target = (await db.execute(select(User).where(User.id == user_id, User.is_deleted.is_(False)))).scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    if payload.role is not None and payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Noma’lum rol")
    if payload.status is not None and payload.status not in STATUSES:
        raise HTTPException(status_code=400, detail="Holat: active yoki blocked")
    if target.id == actor.id and ((payload.role and payload.role != SUPER_ADMIN) or payload.status == "blocked"):
        raise HTTPException(status_code=400, detail="O‘zingizni super admin rolidan chiqara yoki bloklay olmaysiz")
    leaving_admin = target.role == SUPER_ADMIN and ((payload.role and payload.role != SUPER_ADMIN) or payload.status == "blocked")
    if leaving_admin:
        admins = (await db.execute(select(func.count()).select_from(User).where(
            User.role == SUPER_ADMIN, User.status == "active", User.is_deleted.is_(False)))).scalar_one()
        if admins <= 1:
            raise HTTPException(status_code=400, detail="Kamida bitta faol super admin qolishi kerak")
    before = {"role": target.role, "status": target.status}
    if payload.role is not None:
        target.role = payload.role
    if payload.status is not None:
        target.status = payload.status
    audit.record(db, actor_id=actor.id, action="admin.user_update", entity="user", entity_id=target.id,
                 before=before, after={"role": target.role, "status": target.status}, ip=client_ip(request))
    await db.commit()
    return _user_view(target)


# ---------------------------------------------------------------------------
# Overview & audit
# ---------------------------------------------------------------------------

@router.get("/overview")
async def overview(user: User = Depends(require_roles(SUPER_ADMIN)), db: AsyncSession = Depends(get_db)):
    async def count(model, *where):
        return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar_one()

    by_role = dict((await db.execute(select(User.role, func.count()).where(User.is_deleted.is_(False)).group_by(User.role))).all())
    return {
        "users": {r: by_role.get(r, 0) for r in ROLES},
        "users_total": sum(by_role.values()),
        "blocked": await count(User, User.status == "blocked"),
        "tasks": await count(Task),
        "attempts": await count(Attempt),
        "evidence": await count(Evidence),
        "open_flags": await count(IntegrityFlag, IntegrityFlag.status == "pending"),
        "credentials": await count(Credential, Credential.status == "issued"),
        "invites": await count(EmployerInvite),
        "texts": await count(SiteText),
    }


@router.get("/audit")
async def audit_feed(limit: int = Query(100, ge=1, le=500), user: User = Depends(require_roles(SUPER_ADMIN)),
                     db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))).scalars().all()
    ids = {a.actor_id for a in rows if a.actor_id}
    names = {u.id: (u.full_name, u.role) for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return [{"id": str(a.id), "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
             "actor": names.get(a.actor_id, (None, None))[0], "actor_role": names.get(a.actor_id, (None, None))[1],
             "ip": a.ip_address, "ts": a.created_at.isoformat()} for a in rows]
