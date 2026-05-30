from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.infrastructure.database_user_provisioner import (
    DatabaseUserProvisioner,
)
from app.modules.user.user_model import User


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


def build_context(subject: str = "user-1") -> AuthenticatedContext:
    return AuthenticatedContext(
        subject=subject,
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        audience="kanai-api",
        claims={"scope": "openid"},
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
