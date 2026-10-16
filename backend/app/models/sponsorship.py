"""Company sponsorship: sponsored challenges (task sets with a prize) and named scholarships for top-rated students."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class SponsoredChallenge(BaseModel):
    """A company-funded set of existing platform tasks. Results come from the students' verified evidence on
    those tasks during the challenge window, so scoring stays the platform's, never the sponsor's."""
    __tablename__ = "sponsored_challenges"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    career_profile_id = Column(UUID(as_uuid=True), ForeignKey("career_profiles.id"), nullable=True)
    task_ids = Column(JSON, nullable=False, default=list)  # list of task id strings
    prize_note = Column(String(255), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active | closed

    organization = relationship("Organization")


class Scholarship(BaseModel):
    """A named scholarship a company funds at one university, awarded by the university from its rating."""
    __tablename__ = "scholarships"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    university_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=False)
    amount_note = Column(String(120), nullable=True)  # e.g. "oyiga 1 mln so‘m, 1 semestr"
    slots = Column(Integer, default=1, nullable=False)
    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id"), nullable=True)  # None = whole university
    description = Column(Text, nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="open", nullable=False)  # open | awarded | closed

    organization = relationship("Organization", foreign_keys=[org_id])


class ScholarshipAward(BaseModel):
    __tablename__ = "scholarship_awards"

    scholarship_id = Column(UUID(as_uuid=True), ForeignKey("scholarships.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    awarded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rank_at_award = Column(Integer, nullable=True)
    score_at_award = Column(String(20), nullable=True)
