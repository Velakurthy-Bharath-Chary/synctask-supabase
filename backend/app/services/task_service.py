from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from app.models.task import (
    Task, ActivityLog, Comment, ActivityAction, TaskRequest,
    TaskRequestType, TaskRequestStatus, TaskStatus,
)
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskRequestCreate


def _verify_membership(db: Session, project_id: UUID, user_id: UUID):
    """Check if user is a member of the project."""
    project = db.query(Project.id).filter(
        Project.id == project_id,
        Project.is_archived == False,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")


def _verify_owner(db: Session, project_id: UUID, user_id: UUID):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_archived == False,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the project owner can manage tasks")
    return project


def _log_activity(db: Session, task_id: UUID, user_id: UUID, action: ActivityAction, 
                  old_value: dict = None, new_value: dict = None, metadata: dict = None):
    """Record every change made to a task."""
    log = ActivityLog(
        task_id=task_id,
        user_id=user_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        extra_data=metadata
    )
    db.add(log)


def create_task(db: Session, data: TaskCreate, user_id: UUID) -> Task:
    _verify_owner(db, data.project_id, user_id)
    if data.assigned_to:
        _add_project_member(db, data.project_id, data.assigned_to)

    task_data = data.model_dump()
    task = Task(
        **task_data,
        created_by=user_id,
    )
    db.add(task)
    db.flush()  # Get task.id

    # Log the creation
    _log_activity(
        db, task.id, user_id, ActivityAction.TASK_CREATED,
        new_value={"title": task.title, "status": task.status.value}
    )
    db.commit()
    db.refresh(task)
    return task


def get_tasks(db: Session, project_id: UUID, user_id: UUID) -> list:
    _verify_membership(db, project_id, user_id)
    return db.query(Task).filter(
        Task.project_id == project_id,
        Task.is_archived == False
    ).all()


def get_task(db: Session, task_id: UUID, user_id: UUID) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_membership(db, task.project_id, user_id)
    return task


def update_task(db: Session, task_id: UUID, data: TaskUpdate, user_id: UUID) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_owner(db, task.project_id, user_id)

    # Track what changed
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("assigned_to") and update_data["assigned_to"] != task.assigned_to:
        _add_project_member(db, task.project_id, update_data["assigned_to"], exclude_task_id=task.id)
    old_values = {}
    new_values = {}

    for field, value in update_data.items():
        old_value = getattr(task, field)
        if hasattr(old_value, 'value'):  # Handle Enum
            old_value = old_value.value
        if hasattr(value, 'value'):
            value_str = value.value
        else:
            value_str = str(value) if value is not None else None
        
        if old_value != value:
            old_values[field] = str(old_value) if old_value is not None else None
            new_values[field] = value_str
            setattr(task, field, value)

    # Log the changes
    if old_values:
        action = ActivityAction.TASK_UPDATED
        if 'status' in new_values:
            action = ActivityAction.STATUS_CHANGED
        elif 'priority' in new_values:
            action = ActivityAction.PRIORITY_CHANGED
        elif 'assigned_to' in new_values:
            action = ActivityAction.TASK_ASSIGNED
        elif 'deadline' in new_values:
            action = ActivityAction.DEADLINE_SET
        
        _log_activity(db, task.id, user_id, action, old_value=old_values, new_value=new_values)

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: UUID, user_id: UUID):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_owner(db, task.project_id, user_id)

    # Soft delete
    task.is_archived = True
    db.commit()


def _add_project_member(db: Session, project_id: UUID, member_id: UUID, exclude_task_id: UUID = None):
    user = db.query(User).filter(User.id == member_id, User.is_active == True).with_for_update().first()
    if not user:
        raise HTTPException(status_code=422, detail="The selected employee is unavailable")
    if db.query(Project.id).filter(Project.owner_id == member_id).first():
        raise HTTPException(status_code=409, detail="Project owners cannot be assigned to employee tasks")
    busy_query = db.query(Task.id).join(Project, Task.project_id == Project.id).filter(
        Task.assigned_to == member_id,
        Task.status != TaskStatus.DONE,
        Task.is_archived == False,
        Project.is_archived == False,
    )
    if exclude_task_id:
        busy_query = busy_query.filter(Task.id != exclude_task_id)
    busy = busy_query.first()
    if busy:
        raise HTTPException(status_code=409, detail="This employee already has an unfinished task. Complete or unassign that task before assigning another.")
    existing = db.query(ProjectMember).filter_by(project_id=project_id, user_id=member_id).first()
    if not existing:
        db.add(ProjectMember(project_id=project_id, user_id=member_id, role=ProjectRole.member))


def get_assignable_users(db: Session, project_id: UUID, owner_id: UUID) -> list:
    _verify_owner(db, project_id, owner_id)
    users = db.query(User).filter(
        User.is_active == True,
        User.id != owner_id,
        ~User.id.in_(db.query(Project.owner_id)),
    ).order_by(User.username).all()
    active_assignments = db.query(Task.assigned_to).join(
        Project, Task.project_id == Project.id
    ).filter(
        Task.status != TaskStatus.DONE,
        Task.is_archived == False,
        Project.is_archived == False,
        Task.assigned_to.isnot(None),
    ).distinct().all()
    busy_ids = {row[0] for row in active_assignments}
    return [{"id": user.id, "username": user.username, "has_active_task": user.id in busy_ids} for user in users]


def create_task_request(db: Session, task_id: UUID, user_id: UUID, data: TaskRequestCreate) -> TaskRequest:
    task = db.query(Task).filter(Task.id == task_id, Task.is_archived == False).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_membership(db, task.project_id, user_id)
    if task.assigned_to != user_id:
        raise HTTPException(status_code=403, detail="Only the assigned member can request a task change")

    try:
        request_type = TaskRequestType(data.request_type)
    except ValueError:
        raise HTTPException(status_code=422, detail="Request type must be STATUS or DEADLINE")
    if request_type == TaskRequestType.STATUS and data.requested_status is None:
        raise HTTPException(status_code=422, detail="A requested status is required")
    if request_type == TaskRequestType.STATUS and data.requested_status == task.status:
        raise HTTPException(status_code=422, detail="Requested status must differ from the current status")
    if request_type == TaskRequestType.DEADLINE and data.requested_deadline is None:
        raise HTTPException(status_code=422, detail="A requested deadline is required")
    requested_deadline = data.requested_deadline
    if request_type == TaskRequestType.DEADLINE:
        if requested_deadline.tzinfo is None:
            requested_deadline = requested_deadline.replace(tzinfo=timezone.utc)
        if requested_deadline <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="The requested deadline must be in the future")
        current_deadline = task.deadline
        if current_deadline and current_deadline.tzinfo is None:
            current_deadline = current_deadline.replace(tzinfo=timezone.utc)
        if current_deadline and requested_deadline <= current_deadline:
            raise HTTPException(status_code=422, detail="The requested deadline must be later than the current deadline")

    pending = db.query(TaskRequest).filter(
        TaskRequest.task_id == task_id,
        TaskRequest.requester_id == user_id,
        TaskRequest.request_type == request_type,
        TaskRequest.status == TaskRequestStatus.PENDING,
    ).first()
    if pending:
        raise HTTPException(status_code=409, detail="You already have a pending request of this type")

    request = TaskRequest(
        task_id=task_id,
        requester_id=user_id,
        request_type=request_type,
        requested_status=data.requested_status if request_type == TaskRequestType.STATUS else None,
        requested_deadline=requested_deadline if request_type == TaskRequestType.DEADLINE else None,
        message=data.message,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def list_task_requests(db: Session, project_id: UUID, user_id: UUID) -> list:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _verify_membership(db, project_id, user_id)
    query = db.query(TaskRequest).join(Task).filter(Task.project_id == project_id)
    if project.owner_id != user_id:
        query = query.filter(TaskRequest.requester_id == user_id)
    return query.order_by(TaskRequest.created_at.desc()).all()


def decide_task_request(db: Session, request_id: UUID, user_id: UUID, approve: bool, note: str = None) -> TaskRequest:
    request = db.query(TaskRequest).filter(TaskRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    task = db.query(Task).filter(Task.id == request.task_id).first()
    _verify_owner(db, task.project_id, user_id)
    if request.status != TaskRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="This request has already been decided")
    if approve:
        if task.assigned_to != request.requester_id:
            raise HTTPException(status_code=409, detail="This request is stale because the task was reassigned")
        if request.request_type == TaskRequestType.STATUS:
            if task.status == request.requested_status:
                raise HTTPException(status_code=409, detail="The task already has the requested status")
            old_status = task.status.value
            task.status = request.requested_status
        else:
            if task.deadline and request.requested_deadline <= task.deadline:
                raise HTTPException(status_code=409, detail="The requested deadline is no longer later than the current deadline")
            old_deadline = task.deadline.isoformat() if task.deadline else None
            task.deadline = request.requested_deadline
        if request.request_type == TaskRequestType.STATUS:
            _log_activity(db, task.id, user_id, ActivityAction.STATUS_CHANGED,
                          old_value={"status": old_status},
                          new_value={"status": request.requested_status.value})
        else:
            _log_activity(db, task.id, user_id, ActivityAction.DEADLINE_SET,
                          old_value={"deadline": old_deadline},
                          new_value={"deadline": request.requested_deadline.isoformat()})
        request.status = TaskRequestStatus.APPROVED
    else:
        if not note or not note.strip():
            raise HTTPException(status_code=422, detail="A reason is required when rejecting a request")
        request.status = TaskRequestStatus.REJECTED
    request.decision_note = note
    request.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


def get_task_logs(db: Session, task_id: UUID, user_id: UUID) -> list:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_membership(db, task.project_id, user_id)
    return db.query(ActivityLog).filter(ActivityLog.task_id == task_id)\
        .order_by(ActivityLog.created_at.desc()).all()


def create_comment(db: Session, task_id: UUID, user_id: UUID, content: str) -> Comment:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_membership(db, task.project_id, user_id)

    comment = Comment(task_id=task_id, user_id=user_id, content=content)
    db.add(comment)
    
    # Log the comment
    _log_activity(
        db, task_id, user_id, ActivityAction.COMMENT_ADDED,
        new_value={"content": content[:100]}  # Truncate for log
    )
    
    db.commit()
    db.refresh(comment)
    return comment


def get_task_comments(db: Session, task_id: UUID, user_id: UUID) -> list:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _verify_membership(db, task.project_id, user_id)
    return db.query(Comment).filter(Comment.task_id == task_id)\
        .order_by(Comment.created_at.desc()).all()
