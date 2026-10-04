"""Append-only audit journal (section 3.3 "Audit jurnali", section 13.1)."""
from typing import Any, Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def record(
    db: AsyncSession,
    *,
    actor_id: Optional[uuid.UUID],
    action: str,
    entity: str,
    entity_id: Any = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    ip: Optional[str] = None,
) -> None:
    """Adds an audit row to the current transaction; it commits together with the change it describes."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            payload_before=before,
            payload_after=after,
            ip_address=ip,
        )
    )
