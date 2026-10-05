from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from uuid import UUID
from app.core.security import decode_token
from app.core.ws_manager import ws_manager
from app.database import SessionLocal
from app.models.project import Project, ProjectMember

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    token: str = Query(...)
):
    # Verify JWT token before accepting connection
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=4001)
            return
        # Validate it's a valid UUID
        user_id = UUID(user_id_str)
        parsed_project_id = UUID(project_id)
    except (JWTError, ValueError):
        await websocket.close(code=4001)
        return

    with SessionLocal() as db:
        is_member = db.query(ProjectMember.id).join(Project).filter(
            ProjectMember.project_id == parsed_project_id,
            ProjectMember.user_id == user_id,
            Project.is_archived == False,
        ).first()
    if not is_member:
        await websocket.close(code=4003)
        return

    # Connect user to project room (project_id is now a string/UUID)
    await ws_manager.connect(websocket, project_id)

    try:
        # Tell user they are connected
        await websocket.send_json({
            "event": "connected",
            "project_id": project_id,
            "message": "Real-time sync active"
        })

        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, project_id)
