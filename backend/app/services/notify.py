"""In-app notifications. Rows join the caller's transaction, so a notification exists only if the change it reports commits."""
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> None:
    db.add(Notification(user_id=user_id, kind=kind, title=title[:255], body=body, link=link))
