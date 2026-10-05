from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from enum import Enum
from uuid import UUID


class UserRole(str, Enum):
    admin = "admin"
    member = "member"
    guest = "guest"


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    username: str
    email: str
    role: UserRole
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
