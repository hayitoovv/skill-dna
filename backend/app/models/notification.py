from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Notification(BaseModel):
    """In-app notification shown under the bell (invites, verifications, viva results, appeals)."""
    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(50), nullable=False)  # invite_received, invite_answered, evidence_verified, ...
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    link = Column(String(100), nullable=True)  # in-app target, e.g. "student:career", "employer:invites"
    read_at = Column(DateTime(timezone=True), nullable=True)
