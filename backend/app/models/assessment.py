from sqlalchemy import Column, String, ForeignKey, Integer, Float, JSON, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.base import BaseModel

class Task(BaseModel):
    __tablename__ = "tasks"

    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    layer = Column(String(50), nullable=False, index=True)  # KNOW, DO, ADAPT, DEFEND, PROVE
    title = Column(String(255), nullable=False)
    type = Column(String(50), default="code")  # test, code, challenge, viva, project
    spec = Column(JSON, nullable=False)  # Description, constraints, test cases, initial code
    checker_ref = Column(String(255), nullable=True)  # Test suite reference
    ai_mode = Column(String(50), default="AI-assisted")  # AI-free or AI-assisted
    difficulty = Column(String(50), default="L3")
    duration_minutes = Column(Integer, default=35)
    reward_points = Column(Integer, default=15)
    status = Column(String(50), default="active")
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    skill = relationship("Skill", back_populates="tasks")
    variants = relationship("TaskVariant", back_populates="task")
    attempts = relationship("Attempt", back_populates="task")

class TaskVariant(BaseModel):
    __tablename__ = "task_variants"

    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    seed = Column(String(100), nullable=False)
    params = Column(JSON, nullable=False)  # Mutated params for ADAPT
    solution_ref = Column(String(255), nullable=True)
    checksum = Column(String(255), nullable=True)

    task = relationship("Task", back_populates="variants")
    attempts = relationship("Attempt", back_populates="variant")

class Attempt(BaseModel):
    __tablename__ = "attempts"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("task_variants.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="in_progress")  # in_progress, submitted, evaluated, flagged
    ai_mode = Column(String(50), default="AI-assisted")
    duration_seconds = Column(Integer, default=0)

    user = relationship("User", back_populates="attempts")
    task = relationship("Task", back_populates="attempts")
    variant = relationship("TaskVariant", back_populates="attempts")
    submission = relationship("Submission", back_populates="attempt", uselist=False)
    ai_usage_logs = relationship("AIUsageLog", back_populates="attempt")
    viva_session = relationship("VivaSession", back_populates="attempt", uselist=False)
    evaluations = relationship("Evaluation", back_populates="attempt")

class Submission(BaseModel):
    __tablename__ = "submissions"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), unique=True, nullable=False)
    code_content = Column(Text, nullable=True)
    files_ref = Column(String(500), nullable=True)
    repo_url = Column(String(500), nullable=True)
    answers = Column(JSON, default=dict)
    test_results = Column(JSON, default=dict)
    similarity_report = Column(JSON, default=dict)

    attempt = relationship("Attempt", back_populates="submission")

class AIUsageLog(BaseModel):
    __tablename__ = "ai_usage_logs"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=False)
    tool = Column(String(100), default="AI Assistant")
    prompts_ref = Column(JSON, default=list)
    accepted_ratio = Column(Float, default=0.0)
    self_declared_contribution = Column(Float, default=1.0)

    attempt = relationship("Attempt", back_populates="ai_usage_logs")

class VivaSession(BaseModel):
    __tablename__ = "viva_sessions"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), unique=True, nullable=False)
    mode = Column(String(50), default="text")  # text, voice
    plan = Column(JSON, default=dict)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    language = Column(String(10), default="uz")

    attempt = relationship("Attempt", back_populates="viva_session")
    turns = relationship("VivaTurn", back_populates="session")

class VivaTurn(BaseModel):
    __tablename__ = "viva_turns"

    session_id = Column(UUID(as_uuid=True), ForeignKey("viva_sessions.id"), nullable=False)
    role = Column(String(50), nullable=False)  # examiner, student
    content = Column(Text, nullable=False)
    ts = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    latency_ms = Column(Integer, default=0)

    session = relationship("VivaSession", back_populates="turns")

class Evaluation(BaseModel):
    __tablename__ = "evaluations"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=False)
    grader = Column(String(50), default="auto")  # auto, llm, human
    scores = Column(JSON, nullable=False)  # scores per rubric criterion
    total_score = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)
    spans = Column(JSON, default=list)
    model_ref = Column(String(100), nullable=True)

    attempt = relationship("Attempt", back_populates="evaluations")
