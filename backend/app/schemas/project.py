from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum
from app.schemas.user import UserOut


class ProjectRole(str, Enum):
    admin = "admin"
    member = "member"
    guest = "guest"


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    slug: Optional[str] = None  # Auto-generated from name if not provided


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_archived: Optional[bool] = None


class ProjectMemberOut(BaseModel):
    id: UUID
    user: UserOut
    role: ProjectRole
    joined_at: datetime

    class Config:
        from_attributes = True


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    slug: str
    owner_id: UUID
    is_archived: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    members: List[ProjectMemberOut] = []

    class Config:
        from_attributes = True


class ProjectBrowseOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    owner_id: UUID
    created_at: datetime
    member_count: int
