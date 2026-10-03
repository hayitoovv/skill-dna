from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID

class RubricItem(BaseModel):
    level: int
    level_name: str
    criteria: Dict[str, Any]

class SkillItem(BaseModel):
    id: UUID
    code: str
    name: str
    type: str
    framework_refs: Dict[str, Any]

    class Config:
        from_attributes = True

class DirectionItem(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    skills: List[SkillItem] = []

    class Config:
        from_attributes = True
