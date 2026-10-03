from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class UserLogin(BaseModel):
    identifier: str  # email or phone
    password: str

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: str = "student"
    organization_name: Optional[str] = "BSTU"
    direction_code: Optional[str] = "software"
    course: Optional[str] = "1-kurs"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    status: str
    locale: str
    organization: Optional[str] = None

    class Config:
        from_attributes = True

class ConsentUpdate(BaseModel):
    type: str  # viva_record, employer_share, data_processing
    granted: bool
