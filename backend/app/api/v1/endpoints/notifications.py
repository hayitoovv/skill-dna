"""The signed-in user's notifications (bell in the top bar)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Notification, User

router = APIRouter()


def _view(n: Notification) -> dict:
    return {"id": str(n.id), "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
            "read": n.read_at is not None, "created_at": n.created_at.isoformat()}


@router.get("")
async def list_notifications(limit: int = Query(20, ge=1, le=100), user: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Notification).where(Notification.user_id == user.id)
                             .order_by(Notification.created_at.desc()).limit(limit))).scalars().all()
    unread = (await db.execute(select(func.count()).select_from(Notification)
                               .where(Notification.user_id == user.id, Notification.read_at.is_(None)))).scalar_one()
    return {"unread": unread, "items": [_view(n) for n in rows]}


@router.post("/read-all")
async def read_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
                     .values(read_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"unread": 0}


@router.post("/{notification_id}/read")
async def read_one(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(Notification).where(Notification.id == notification_id))).scalars().first()
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Bildirishnoma topilmadi")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.commit()
    return _view(n)
