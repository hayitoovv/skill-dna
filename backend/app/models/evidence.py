from sqlalchemy import Column, String, ForeignKey, Float, JSON, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.base import BaseModel

class Evidence(BaseModel):
    __tablename__ = "evidence"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False, index=True)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=True)
    layer = Column(String(50), nullable=False)  # KNOW, DO, ADAPT, DEFEND, PROVE
    title = Column(String(255), nullable=False)
    source_ref = Column(String(500), nullable=True)  # link to submission or test
    score = Column(Float, nullable=False)  # 0 to 100
    weight = Column(Float, default=1.0)
    verified_by = Column(String(100), default="automated")
    verified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="verified")  # verified, pending, rejected

    user = relationship("User", back_populates="evidence")
    skill = relationship("Skill", back_populates="evidence")
    attempt = relationship("Attempt")

class EvidenceEdge(BaseModel):
    __tablename__ = "evidence_edges"

    from_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=False)
    to_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=False)
    type = Column(String(50), nullable=False)  # supports, contradicts, derived_from, verifies

    from_evidence = relationship("Evidence", foreign_keys=[from_id])
    to_evidence = relationship("Evidence", foreign_keys=[to_id])

class SkillScore(BaseModel):
    __tablename__ = "skill_scores"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False, index=True)
    score = Column(Float, nullable=False)  # 0 to 100
    confidence = Column(Float, nullable=False)  # 0 to 100 (%)
    level = Column(String(20), nullable=False)  # L1, L2, L3, L4, L5
    components = Column(JSON, default=dict)  # breakdown: KNOW, DO, ADAPT, DEFEND, PROVE
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    formula_version = Column(String(20), default="2.0")

    user = relationship("User", back_populates="skill_scores")
    skill = relationship("Skill")

class IntegrityFlag(BaseModel):
    __tablename__ = "integrity_flags"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=True)
    type = Column(String(100), nullable=False)  # suspicious_paste, ai_mismatch, prompt_injection, low_viva_defense
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    details = Column(JSON, default=dict)
    status = Column(String(50), default="pending")  # pending, reviewed, dismissed, confirmed
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    attempt = relationship("Attempt")

class Credential(BaseModel):
    __tablename__ = "credentials"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=True)
    certificate_code = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    level = Column(String(20), nullable=False)
    ob3_payload = Column(JSON, nullable=False)  # Open Badges 3.0 W3C Verifiable Credential standard
    status = Column(String(50), default="issued")
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    skill = relationship("Skill")
