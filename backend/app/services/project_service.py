import re
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectUpdate


def _generate_slug(name: str) -> str:
    """Generate URL-friendly slug from project name."""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def create_project(db: Session, data: ProjectCreate, owner_id: UUID) -> Project:
    # Generate slug from name if not provided
    slug = data.slug if data.slug else _generate_slug(data.name)
    
    # Check if slug already exists
    existing = db.query(Project).filter(Project.slug == slug).first()
    if existing:
        # Append a number to make it unique
        import uuid
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"
    
    project = Project(
        name=data.name,
        description=data.description,
        slug=slug,
        owner_id=owner_id
    )
    db.add(project)
    db.flush()  # Get project.id before commit

    # Auto-add owner as admin member
    member = ProjectMember(project_id=project.id, user_id=owner_id, role=ProjectRole.admin)
    db.add(member)
    db.commit()
    db.refresh(project)
    return project


def get_user_projects(db: Session, user_id: UUID) -> list:
    """Get all projects where the user is a member."""
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == user_id).all()
    project_ids = [m.project_id for m in memberships]
    return db.query(Project).filter(
        Project.id.in_(project_ids),
        Project.is_archived == False
    ).options(selectinload(Project.members).selectinload(ProjectMember.user)).all()


def get_project(db: Session, project_id: UUID, user_id: UUID) -> Project:
    project = db.query(Project).options(
        selectinload(Project.members).selectinload(ProjectMember.user)
    ).filter(Project.id == project_id, Project.is_archived == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check user is a member
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")

    return project


def update_project(db: Session, project_id: UUID, data: ProjectUpdate, user_id: UUID) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_archived == False,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the owner can update this project")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: UUID, user_id: UUID):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this project")

    # Archive the project's tasks and release every assignee immediately.
    # The project remains hidden in storage, but its work must not reserve
    # members or remain available through task endpoints.
    db.query(Task).filter(
        Task.project_id == project_id,
        Task.is_archived == False,
    ).update(
        {Task.is_archived: True, Task.assigned_to: None},
        synchronize_session=False,
    )
    project.is_archived = True
    db.commit()


def get_all_projects(db: Session) -> list:
    """List all non-archived projects for browsing."""
    member_counts = db.query(
        ProjectMember.project_id.label("project_id"),
        func.count(ProjectMember.id).label("member_count"),
    ).group_by(ProjectMember.project_id).subquery()
    rows = db.query(Project, func.coalesce(member_counts.c.member_count, 0)).outerjoin(
        member_counts, Project.id == member_counts.c.project_id
    ).filter(Project.is_archived == False).all()
    return [
        {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "owner_id": project.owner_id,
            "created_at": project.created_at,
            "member_count": member_count,
        }
        for project, member_count in rows
    ]
