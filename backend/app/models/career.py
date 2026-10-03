from sqlalchemy import Column, String, ForeignKey, Float, JSON, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.base import BaseModel

class CareerProfile(BaseModel):
    __tablename__ = "career_profiles"

    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id"), nullable=False)
    role_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    requirements = Column(JSON, nullable=False)  # skill requirements with weights & min scores
    development_roadmap = Column(JSON, default=list)  # 30/60/90 days recommended steps

    direction = relationship("Direction", back_populates="career_profiles")

class EmployerCriteria(BaseModel):
    __tablename__ = "employer_criteria"

    employer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    job_title = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    criteria = Column(JSON, nullable=False)  # required skills, min scores, min confidence
    status = Column(String(50), default="active")

    employer = relationship("User")

class Match(BaseModel):
    __tablename__ = "matches"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    career_profile_id = Column(UUID(as_uuid=True), ForeignKey("career_profiles.id"), nullable=True)
    employer_criteria_id = Column(UUID(as_uuid=True), ForeignKey("employer_criteria.id"), nullable=True)
    match_pct = Column(Float, nullable=False)  # e.g. 85.0%
    gaps = Column(JSON, default=list)  # Missing skills & needed points
    explanation = Column(JSON, default=dict)  # Why match? (AI reason)
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
    career_profile = relationship("CareerProfile")
    employer_criteria = relationship("EmployerCriteria")

class Appeal(BaseModel):
    __tablename__ = "appeals"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="pending")  # pending, under_review, approved, rejected
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    attempt = relationship("Attempt")

class AuditLog(BaseModel):
    __tablename__ = "audit_log"

    actor_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    payload_before = Column(JSON, nullable=True)
    payload_after = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
