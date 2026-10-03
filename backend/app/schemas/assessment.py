from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

class TaskItem(BaseModel):
    id: UUID
    skill_id: UUID
    layer: str
    title: str
    type: str
    spec: Dict[str, Any]
    ai_mode: str
    difficulty: str
    duration_minutes: int
    reward_points: int

    class Config:
        from_attributes = True

class AttemptStart(BaseModel):
    task_id: UUID
    ai_mode: Optional[str] = "AI-assisted"

class SubmissionPayload(BaseModel):
    attempt_id: UUID
    code_content: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    ai_used: Optional[bool] = False
    ai_prompts_count: Optional[int] = 0

class VivaMessagePayload(BaseModel):
    session_id: UUID
    content: str

class VivaTurnItem(BaseModel):
    id: UUID
    role: str
    content: str
    ts: datetime

    class Config:
        from_attributes = True

class EvaluationResult(BaseModel):
    total_score: float
    scores: Dict[str, Any]
    rationale: str
    earned_points: int
    new_skill_score: float
    new_confidence: float
