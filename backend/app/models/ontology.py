from sqlalchemy import Column, String, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Direction(BaseModel):
    __tablename__ = "directions"

    code = Column(String(50), unique=True, index=True, nullable=False)  # software, computer, ai
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    version = Column(String(20), default="2.0")

    skills = relationship("Skill", back_populates="direction")
    career_profiles = relationship("CareerProfile", back_populates="direction")

class Skill(BaseModel):
    __tablename__ = "skills"

    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="core")  # core, sub, cross
    framework_refs = Column(JSON, default=dict)  # SFIA, ESCO, DigComp references
    version = Column(String(20), default="1.0")

    direction = relationship("Direction", back_populates="skills")
    rubrics = relationship("Rubric", back_populates="skill")
    tasks = relationship("Task", back_populates="skill")
    evidence = relationship("Evidence", back_populates="skill")

class Rubric(BaseModel):
    __tablename__ = "rubrics"

    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    level = Column(Integer, nullable=False)  # 1 (Remember/KNOW) to 5 (Master/PROVE)
    level_name = Column(String(100), nullable=False)  # e.g. L1 UNDERSTAND, L2 APPLY, L3 ANALYZE, L4 CREATE, L5 MASTER
    criteria = Column(JSON, nullable=False)  # Observational rubric items
    version = Column(String(20), default="1.0")

    skill = relationship("Skill", back_populates="rubrics")
