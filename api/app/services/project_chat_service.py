"""Project chat history and message creation service."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.models.project import ProjectChatMessage
from app.models.user import User
from app.schemas.project import ProjectChatAuthorRead, ProjectChatMessageRead
from app.services.project_access import ProjectAccess


LATEST_HISTORY_LIMIT = 50
MAX_CHAT_MESSAGE_BODY_LENGTH = 4_000


class ProjectChatService:
    """Provides project-scoped chat history operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self._session = session

    async def list_latest_messages(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        cursor: UUID | None = None,
        limit: int = LATEST_HISTORY_LIMIT,
    ) -> list[ProjectChatMessageRead]:
        """Return project chat messages oldest-to-newest.

        When a cursor is provided, it must be the oldest loaded message id and
        the returned page contains messages chronologically before it.
        """
        await ProjectAccess(self._session).require_project(project_id, user_id)
        chat_messages = SQLModel.metadata.tables["project_chat_messages"]
        users = SQLModel.metadata.tables["users"]

        statement = select(ProjectChatMessage).filter_by(project_id=project_id)
        if cursor is not None:
            cursor_message = await self._session.scalar(
                select(ProjectChatMessage).filter_by(project_id=project_id, id=cursor)
            )
            if cursor_message is None or cursor_message.created_at is None:
                return []

            statement = statement.where(
                (chat_messages.c.created_at < cursor_message.created_at)
                | (
                    (chat_messages.c.created_at == cursor_message.created_at)
                    & (chat_messages.c.id < cursor_message.id)
                )
            )

        messages = await self._session.scalars(
            statement
            .order_by(
                chat_messages.c.created_at.desc(),
                chat_messages.c.id.desc(),
            )
            .limit(limit)
        )
        ordered_messages = list(reversed(list(messages.all())))
        author_ids = {
            message.author_id
            for message in ordered_messages
            if message.author_id is not None
        }
        existing_author_ids: set[UUID] = set()
        if author_ids:
            existing_authors = await self._session.scalars(
                select(users.c.id).where(users.c.id.in_(author_ids))
            )
            existing_author_ids = set(existing_authors.all())

        return [
            self._message_to_read(
                message,
                author_deleted=message.author_id not in existing_author_ids,
            )
            for message in ordered_messages
        ]

    async def create_text_message(
        self,
        project_id: UUID,
        author: User,
        body: str,
    ) -> ProjectChatMessageRead:
        """Persist a project chat text message and return its saved payload."""
        if author.id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        await ProjectAccess(self._session).require_project(project_id, author.id)
        normalized_body = _normalize_message_body(body)
        message = ProjectChatMessage(
            project_id=project_id,
            author_id=author.id,
            author_display_name=_author_label_snapshot(author),
            body=normalized_body,
        )
        self._session.add(message)
        await self._session.commit()
        await self._session.refresh(message)
        return self._message_to_read(message, author_deleted=False)

    @staticmethod
    def _message_to_read(
        message: ProjectChatMessage, *, author_deleted: bool
    ) -> ProjectChatMessageRead:
        if message.id is None or message.created_at is None:
            raise RuntimeError("Chat message is missing generated fields")

        display_name = message.author_display_name.strip() or "Unknown user"
        return ProjectChatMessageRead(
            id=message.id,
            project_id=message.project_id,
            body=message.body,
            created_at=message.created_at,
            author=ProjectChatAuthorRead(
                id=message.author_id,
                display_name=display_name,
                initials=_initials(display_name),
                deleted=author_deleted,
            ),
        )


def _initials(display_name: str) -> str:
    parts = [part for part in display_name.split() if part]
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    if parts:
        return parts[0][0].upper()
    return "?"


def _normalize_message_body(body: str) -> str:
    normalized_body = body.strip()
    if not normalized_body:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Message body cannot be blank",
        )
    if len(normalized_body) > MAX_CHAT_MESSAGE_BODY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Message body cannot exceed 4000 characters",
        )
    return normalized_body


def _author_label_snapshot(author: User) -> str:
    for value in (
        author.preferred_username,
        author.display_name,
        author.externalId,
        str(author.id),
    ):
        if value is None:
            continue
        display_name = value.strip()
        if display_name:
            return display_name
    return "Unknown user"
