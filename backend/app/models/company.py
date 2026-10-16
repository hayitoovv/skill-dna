"""Companies: vacancies tied to professions, hiring statistics and the employer plan (invite credits).

The company itself is an `organizations` row with type="company"; its public profile (industry, region,
website, about) lives in `Organization.settings`, so no existing table changes.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Vacancy(BaseModel):
    __tablename__ = "vacancies"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # The profession this vacancy hires for: its skill requirements drive candidate matching
    career_profile_id = Column(UUID(as_uuid=True), ForeignKey("career_profiles.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    openings = Column(Integer, default=1, nullable=False)
    employment_type = Column(String(30), default="full_time", nullable=False)  # full_time | part_time | internship
    city = Column(String(100), nullable=True)
    salary_note = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="open", nullable=False, index=True)  # open | closed

    organization = relationship("Organization")
    career_profile = relationship("CareerProfile")


class HiringStat(BaseModel):
    """Manually entered hires of a company in a year (optionally from one university).
    Hires made through the platform (accepted invites) are counted live, not stored here."""
    __tablename__ = "hiring_stats"

    company_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    university_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    year = Column(Integer, nullable=False)
    hired_count = Column(Integer, nullable=False)
    note = Column(String(255), nullable=True)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class EmployerPlan(BaseModel):
    """Plan of a company (section: financial model). Each new candidate invite spends one credit;
    credits reset monthly. Payment is handled outside the platform; a super admin sets the tier."""
    __tablename__ = "employer_plans"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    tier = Column(String(20), default="free", nullable=False)  # free | pro
    period_start = Column(DateTime(timezone=True), nullable=True)
    credits_used = Column(Integer, default=0, nullable=False)
