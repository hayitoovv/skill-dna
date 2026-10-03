from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

class EvidenceItem(BaseModel):
    id: UUID
    layer: str
    title: str
    score: float
    status: str
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SkillScoreItem(BaseModel):
    skill_id: UUID
    skill_name: str
    score: float
    confidence: float
    level: str
    components: Dict[str, float]

class EvidenceGraphNode(BaseModel):
    id: str
    label: str
    type: str  # task, submission, tests, viva, evidence, score
    status: str
    score: Optional[float] = None

class EvidenceGraphEdge(BaseModel):
    source: str
    target: str
    type: str  # verifies, derives, supports

class EvidenceGraphData(BaseModel):
    nodes: List[EvidenceGraphNode]
    edges: List[EvidenceGraphEdge]
