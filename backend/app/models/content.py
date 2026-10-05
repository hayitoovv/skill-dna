from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class SiteText(BaseModel):
    """A super-admin text override: wherever `source` is shown in the UI, `value` is shown instead.
    Keyed by the exact displayed text, so it also covers strings that live in component code."""
    __tablename__ = "site_texts"

    source_hash = Column(String(64), unique=True, index=True, nullable=False)  # sha256(source)
    source = Column(Text, nullable=False)
    value = Column(Text, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
