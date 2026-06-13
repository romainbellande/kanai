"""Project API routes."""

from json import JSONDecodeError
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from starlette.websockets import WebSocketState

from app.api import deps
from app.api.deps import CurrentUser, DatabaseSession
from app.features.tasks import task_router
from app.schemas.project import (
    ProjectBacklogReorder,
    ProjectColumnCreate,
    ProjectColumnRead,
    ProjectColumnReorder,
    ProjectColumnUpdate,
    ProjectChatMessageRead,
    ProjectCreate,
    ProjectDoneColumnRead,
    ProjectDoneColumnUpdate,
    ProjectMemberCreate,
    ProjectRead,
    ProjectSprintCreate,
    ProjectSprintClosePreviewRead,
    ProjectSprintCloseRead,
    ProjectSprintHistoryRead,
    ProjectSprintRead,
    ProjectSprintTaskAdd,
    ProjectSprintUpdate,
    ProjectUpdate,
)
from app.schemas.task import TaskCreate, TaskRead
from app.services.project_chat_fanout import project_chat_fanout
from app.services.project_chat_service import ProjectChatService
from app.services.project_column_service import ProjectColumnService
from app.services.project_access import ProjectAccess
from app.services.project_backlog_service import ProjectBacklogService
from app.services.project_done_column_service import ProjectDoneColumnService
from app.services.project_sprint_service import ProjectSprintService
from app.services.project_service import (
    add_project_member_for_user,
    create_project_for_user,
    delete_project_for_user,
    list_projects_for_user,
    project_to_read,
    require_current_user_id,
    require_project_access,
    update_project_for_user,
)
from app.services.auth_service import WebSocketAuthError


project_router = APIRouter(prefix="/projects", tags=["projects"])
project_router.include_router(task_router)

PROJECT_CHAT_SUBPROTOCOL = "kanai.project-chat"


@project_router.post(
    "", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
async def create_project_endpoint(
    payload: ProjectCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Create a project for the current user."""
    return await create_project_for_user(
        session,
        creator_user_id=require_current_user_id(current_user.id),
        name=payload.name,
        code=payload.code,
        description=payload.description,
        status_value=payload.status,
        owner_ids=payload.owner_ids,
        member_ids=payload.member_ids,
    )


@project_router.get("", response_model=list[ProjectRead])
async def list_projects(
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectRead]:
    """List projects accessible to the current user."""
    return await list_projects_for_user(
        session,
        require_current_user_id(current_user.id),
    )


@project_router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Get a project accessible to the current user."""
    project = await require_project_access(
        session,
        project_id,
        require_current_user_id(current_user.id),
    )
    return await project_to_read(session, project)


@project_router.get("/{project_id}/columns", response_model=list[ProjectColumnRead])
async def list_project_columns(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectColumnRead]:
    """List workflow columns for a project accessible to the current user."""
    return await ProjectColumnService(session).list(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.get("/{project_id}/done-column", response_model=ProjectDoneColumnRead)
async def get_project_done_column(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectDoneColumnRead:
    """Get the Done Column designation for a project visible to the user."""
    return await ProjectDoneColumnService(session).get(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.patch("/{project_id}/done-column", response_model=ProjectDoneColumnRead)
async def update_project_done_column(
    project_id: UUID,
    payload: ProjectDoneColumnUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectDoneColumnRead:
    """Change the Done Column designation for a project owned by the user."""
    return await ProjectDoneColumnService(session).update(
        project_id,
        require_current_user_id(current_user.id),
        done_column_id=payload.done_column_id,
    )


@project_router.get("/{project_id}/backlog", response_model=list[TaskRead])
async def list_project_backlog(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[TaskRead]:
    """List unfinished non-sprint tasks in project Backlog order."""
    return await ProjectBacklogService(session).list(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.put("/{project_id}/backlog/reorder", response_model=list[TaskRead])
async def reorder_project_backlog(
    project_id: UUID,
    payload: ProjectBacklogReorder,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[TaskRead]:
    """Persist a complete manual Backlog task order."""
    return await ProjectBacklogService(session).reorder(
        project_id,
        require_current_user_id(current_user.id),
        payload,
    )


@project_router.post(
    "/{project_id}/backlog/tasks",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_backlog_task(
    project_id: UUID,
    payload: TaskCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Create a task at the top of the project Backlog."""
    return await ProjectBacklogService(session).create_task(
        project_id,
        require_current_user_id(current_user.id),
        payload,
    )


@project_router.get(
    "/{project_id}/sprints/active", response_model=ProjectSprintRead | None
)
async def get_active_project_sprint(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectSprintRead | None:
    """Get the active sprint for a project accessible to the current user."""
    return await ProjectSprintService(session).get_active(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.get(
    "/{project_id}/sprints/history",
    response_model=list[ProjectSprintHistoryRead],
)
async def list_project_sprint_history(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectSprintHistoryRead]:
    """List closed sprint history for a project participant."""
    return await ProjectSprintService(session).list_history(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.post(
    "/{project_id}/sprints",
    response_model=ProjectSprintRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_sprint(
    project_id: UUID,
    payload: ProjectSprintCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectSprintRead:
    """Create an empty active sprint for a project owned by the current user."""
    return await ProjectSprintService(session).create(
        project_id,
        require_current_user_id(current_user.id),
        planned_start_date=payload.planned_start_date,
        planned_end_date=payload.planned_end_date,
        goal=payload.goal,
        task_ids=payload.task_ids,
    )


@project_router.post("/{project_id}/sprints/active/tasks", response_model=TaskRead)
async def add_task_to_active_project_sprint(
    project_id: UUID,
    payload: ProjectSprintTaskAdd,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Add an existing Backlog task to the active sprint."""
    return await ProjectSprintService(session).add_task_to_active(
        project_id,
        require_current_user_id(current_user.id),
        payload,
    )


@project_router.delete(
    "/{project_id}/sprints/active/tasks/{task_id}",
    response_model=TaskRead,
)
async def remove_task_from_active_project_sprint(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Remove an active sprint task back to the project Backlog."""
    return await ProjectSprintService(session).remove_task_from_active(
        project_id,
        require_current_user_id(current_user.id),
        task_id,
    )


@project_router.get(
    "/{project_id}/sprints/active/close-confirmation",
    response_model=ProjectSprintClosePreviewRead,
)
async def get_active_project_sprint_close_confirmation(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectSprintClosePreviewRead:
    """Preview the irreversible active sprint close outcome."""
    return await ProjectSprintService(session).close_confirmation(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.post(
    "/{project_id}/sprints/active/close",
    response_model=ProjectSprintCloseRead,
)
async def close_active_project_sprint(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectSprintCloseRead:
    """Close the active sprint and create immutable task history."""
    return await ProjectSprintService(session).close_active(
        project_id,
        require_current_user_id(current_user.id),
    )


@project_router.patch("/{project_id}/sprints/active", response_model=ProjectSprintRead)
async def update_active_project_sprint(
    project_id: UUID,
    payload: ProjectSprintUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectSprintRead:
    """Update active sprint metadata for a project owned by the current user."""
    return await ProjectSprintService(session).update_active(
        project_id,
        require_current_user_id(current_user.id),
        payload,
    )


@project_router.get(
    "/{project_id}/chat/messages", response_model=list[ProjectChatMessageRead]
)
async def list_project_chat_messages(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
    cursor: UUID | None = None,
) -> list[ProjectChatMessageRead]:
    """List chat history for a project accessible to the current user."""
    return await ProjectChatService(session).list_latest_messages(
        project_id,
        require_current_user_id(current_user.id),
        cursor=cursor,
    )


@project_router.websocket("/{project_id}/chat/socket")
async def project_chat_socket(
    websocket: WebSocket,
    project_id: UUID,
    session: DatabaseSession,
) -> None:
    """Connect to project chat after subprotocol bearer authentication."""
    try:
        user = await deps.websocket_auth_boundary.current_user(websocket, session)
        user_id = require_current_user_id(user.id)
        await ProjectAccess(session).require_project(
            project_id,
            user_id,
        )
    except (HTTPException, WebSocketAuthError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept(subprotocol=_accepted_chat_subprotocol(websocket))
    await project_chat_fanout.connect(project_id, websocket)
    await websocket.send_json({"type": "ready", "project_id": str(project_id)})

    try:
        while True:
            try:
                event = await websocket.receive_json()
            except JSONDecodeError:
                await _send_chat_error(
                    websocket,
                    code="invalid_json",
                    message="Chat events must be valid JSON.",
                )
                continue

            if not isinstance(event, dict) or not isinstance(event.get("type"), str):
                await _send_chat_error(
                    websocket,
                    code="protocol_error",
                    message="Chat events must include a string type.",
                )
                continue

            if event["type"] != "create-message":
                await _send_chat_error(
                    websocket,
                    code="unsupported_event",
                    message="Unsupported chat event.",
                )
                continue

            body = event.get("body")
            if not isinstance(body, str):
                await _send_chat_error(
                    websocket,
                    code="invalid_message",
                    message="Message body is required.",
                )
                continue

            client_message_id = event.get("client_message_id")
            if client_message_id is not None and not isinstance(client_message_id, str):
                await _send_chat_error(
                    websocket,
                    code="invalid_message",
                    message="Client message id must be a string.",
                )
                continue

            try:
                message = await ProjectChatService(session).create_text_message(
                    project_id,
                    user,
                    body,
                )
            except HTTPException as error:
                await _send_chat_error(
                    websocket,
                    code="message_rejected",
                    message=str(error.detail),
                )
                continue

            created_event: dict[str, object] = {
                "type": "created-message",
                "message": message.model_dump(mode="json"),
            }
            if client_message_id is not None:
                created_event["client_message_id"] = client_message_id

            await project_chat_fanout.broadcast(project_id, created_event)
    except WebSocketDisconnect:
        return
    finally:
        await project_chat_fanout.disconnect(project_id, websocket)


def _accepted_chat_subprotocol(websocket: WebSocket) -> str | None:
    subprotocols = websocket.scope.get("subprotocols", [])
    if isinstance(subprotocols, list) and PROJECT_CHAT_SUBPROTOCOL in subprotocols:
        return PROJECT_CHAT_SUBPROTOCOL
    return None


async def _send_chat_error(
    websocket: WebSocket,
    *,
    code: str,
    message: str,
) -> None:
    if websocket.client_state != WebSocketState.CONNECTED:
        return

    await websocket.send_json(
        {
            "type": "error",
            "error": {
                "code": code,
                "message": message,
            },
        }
    )


@project_router.post(
    "/{project_id}/columns",
    response_model=ProjectColumnRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_column(
    project_id: UUID,
    payload: ProjectColumnCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectColumnRead:
    """Create a workflow column for a project owned by the current user."""
    return await ProjectColumnService(session).create(
        project_id,
        require_current_user_id(current_user.id),
        name=payload.name,
        description=payload.description,
    )


@project_router.patch(
    "/{project_id}/columns/{column_id}",
    response_model=ProjectColumnRead,
)
async def update_project_column(
    project_id: UUID,
    column_id: UUID,
    payload: ProjectColumnUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectColumnRead:
    """Rename a workflow column for a project owned by the current user."""
    return await ProjectColumnService(session).update(
        project_id,
        column_id,
        require_current_user_id(current_user.id),
        name=payload.name,
        description=payload.description,
        update_description="description" in payload.model_fields_set,
    )


@project_router.put(
    "/{project_id}/columns/reorder",
    response_model=list[ProjectColumnRead],
)
async def reorder_project_columns(
    project_id: UUID,
    payload: ProjectColumnReorder,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectColumnRead]:
    """Reorder all workflow columns for a project owned by the current user."""
    return await ProjectColumnService(session).reorder(
        project_id,
        require_current_user_id(current_user.id),
        column_ids=payload.column_ids,
    )


@project_router.delete(
    "/{project_id}/columns/{column_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_project_column(
    project_id: UUID,
    column_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete an empty workflow column from a project owned by the current user."""
    await ProjectColumnService(session).delete(
        project_id,
        column_id,
        require_current_user_id(current_user.id),
    )


@project_router.post("/{project_id}/members", response_model=ProjectRead)
async def add_project_member(
    project_id: UUID,
    payload: ProjectMemberCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Add a member to a project owned by the current user."""
    return await add_project_member_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
        member_user_id=payload.user_id,
    )


@project_router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Update a project owned by the current user."""
    return await update_project_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
        payload=payload,
    )


@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a project owned by the current user."""
    await delete_project_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
    )
