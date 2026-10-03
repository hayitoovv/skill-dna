from sqlalchemy import Column, String, ForeignKey, JSON, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    EMPLOYER = "employer"
    UNIVERSITY = "university"
    MODERATOR = "moderator"
    SUPER_ADMIN = "super_admin"

class OrganizationType(str, enum.Enum):
    UNIVERSITY = "university"
    COMPANY = "company"

class Organization(BaseModel):
    __tablename__ = "organizations"

    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), default="university")
    settings = Column(JSON, default=dict)

    users = relationship("User", back_populates="organization")

class User(BaseModel):
    __tablename__ = "users"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.STUDENT.value, index=True, nullable=False)
    status = Column(String(50), default="active")
    locale = Column(String(10), default="uz")
    bio = Column(String(1000), nullable=True)

    organization = relationship("Organization", back_populates="users")
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    consents = relationship("Consent", back_populates="user")
    attempts = relationship("Attempt", back_populates="user")
    evidence = relationship("Evidence", back_populates="user")
    skill_scores = relationship("SkillScore", back_populates="user")

class StudentProfile(BaseModel):
    __tablename__ = "student_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id"), nullable=True)
    course = Column(String(50), nullable=True)
    group_id = Column(String(100), nullable=True)
    cohort = Column(String(50), nullable=True)

    user = relationship("User", back_populates="student_profile")
    direction = relationship("Direction")

class Consent(BaseModel):
    __tablename__ = "consents"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(100), nullable=False)  # viva_record, employer_share, data_processing
    granted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="consents")
