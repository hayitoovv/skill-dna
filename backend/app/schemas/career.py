from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID

class CareerProfileItem(BaseModel):
    id: UUID
    role_name: str
    description: Optional[str] = None
    requirements: Dict[str, Any]
    development_roadmap: List[Dict[str, Any]]

    class Config:
        from_attributes = True

class MatchResult(BaseModel):
    role_name: str
    match_pct: float
    gaps: List[Dict[str, Any]]
    explanation: Dict[str, Any]
