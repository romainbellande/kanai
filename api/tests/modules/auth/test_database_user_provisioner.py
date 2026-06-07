from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.core.exceptions import AuthenticationServiceException
from app.models.user import User
from app.repositories.user_repository import DatabaseUserProvisioner
from app.schemas.auth import AuthenticatedContext, JsonValue


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "user_provisioner.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


def build_context(
    subject: str = "user-1",
    claims: dict[str, JsonValue] | None = None,
) -> AuthenticatedContext:
    return AuthenticatedContext(
        subject=subject,
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        audience="kanai-api",
        claims=claims or {"scope": "openid"},
    )


@pytest.mark.asyncio
async def test_provision_creates_missing_authenticated_user(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    provisioner = DatabaseUserProvisioner(session_factory)

    await provisioner.provision(build_context("new-user"))

    async with session_factory() as session:
        user = await session.scalar(select(User).filter_by(externalId="new-user"))

    assert user is not None
    assert user.externalId == "new-user"


@pytest.mark.asyncio
async def test_provision_creates_user_with_preferred_username_display_name(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    provisioner = DatabaseUserProvisioner(session_factory)

    await provisioner.provision(
        build_context("new-user", {"preferred_username": "Jane Doe"})
    )

    async with session_factory() as session:
        user = await session.scalar(select(User).filter_by(externalId="new-user"))

    assert user is not None
    assert user.display_name == "Jane Doe"


@pytest.mark.asyncio
async def test_provision_updates_existing_user_display_name_from_preferred_username(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        session.add(User(externalId="existing-user", display_name="Old Name"))
        await session.commit()

    provisioner = DatabaseUserProvisioner(session_factory)

    await provisioner.provision(
        build_context("existing-user", {"preferred_username": "New Name"})
    )

    async with session_factory() as session:
        user = await session.scalar(select(User).filter_by(externalId="existing-user"))

    assert user is not None
    assert user.display_name == "New Name"


@pytest.mark.asyncio
async def test_provision_preserves_existing_display_name_when_claim_is_blank_or_missing(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        session.add(User(externalId="blank-user", display_name="Blank Name"))
        session.add(User(externalId="missing-user", display_name="Missing Name"))
        await session.commit()

    provisioner = DatabaseUserProvisioner(session_factory)

    await provisioner.provision(
        build_context("blank-user", {"preferred_username": "   "})
    )
    await provisioner.provision(build_context("missing-user"))

    async with session_factory() as session:
        blank_user = await session.scalar(select(User).filter_by(externalId="blank-user"))
        missing_user = await session.scalar(
            select(User).filter_by(externalId="missing-user")
        )

    assert blank_user is not None
    assert blank_user.display_name == "Blank Name"
    assert missing_user is not None
    assert missing_user.display_name == "Missing Name"


@pytest.mark.asyncio
async def test_provision_does_not_duplicate_existing_authenticated_user(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        session.add(User(externalId="existing-user"))
        await session.commit()

    provisioner = DatabaseUserProvisioner(session_factory)

    await provisioner.provision(build_context("existing-user"))

    async with session_factory() as session:
        user_count = await session.scalar(
            select(func.count()).select_from(User).filter_by(externalId="existing-user")
        )

    assert user_count == 1


@pytest.mark.asyncio
async def test_provision_maps_database_errors_to_authentication_service_exception(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async def failing_scalar(
        self: AsyncSession, *args: object, **kwargs: object
    ) -> None:
        del self, args, kwargs
        raise SQLAlchemyError("database unavailable")

    monkeypatch.setattr(AsyncSession, "scalar", failing_scalar)
    provisioner = DatabaseUserProvisioner(session_factory)

    with pytest.raises(AuthenticationServiceException):
        await provisioner.provision(build_context())
