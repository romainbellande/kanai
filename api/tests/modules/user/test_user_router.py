from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.api.v1.endpoints.users import user_router
from app.core.security import AuthMiddleware
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary


class StubAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        del bearer_token
        return AuthenticatedContext(
            subject="current-user",
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            audience="kanai-api",
            claims={"scope": "openid"},
        )


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "user_router.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(StubAuthenticateRequest()),
    )
    app.include_router(user_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def current_user(
    session_factory: async_sessionmaker[AsyncSession],
) -> User:
    async with session_factory() as session:
        user = User(externalId="current-user")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.mark.asyncio
async def test_user_crud_endpoints(
    client: AsyncClient,
    current_user: User,
) -> None:
    current_user_id = current_user.id
    assert current_user_id is not None

    me_response = await client.get(
        "/users/me",
        headers={"Authorization": "Bearer token"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["id"] == str(current_user_id)

    create_response = await client.post(
        "/users",
        headers={"Authorization": "Bearer token"},
        json={"external_id": "new-user", "display_name": "Ignored Name"},
    )

    assert create_response.status_code == 201
    created_user = create_response.json()
    assert created_user["external_id"] == "new-user"
    assert created_user["display_name"] is None
    assert created_user["first_name"] is None
    assert created_user["last_name"] is None

    list_response = await client.get(
        "/users",
        headers={"Authorization": "Bearer token"},
    )

    assert list_response.status_code == 200
    assert [user["external_id"] for user in list_response.json()] == [
        "current-user",
        "new-user",
    ]

    get_response = await client.get(
        f"/users/{created_user['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert get_response.status_code == 200
    assert get_response.json()["external_id"] == "new-user"

    update_response = await client.patch(
        f"/users/{created_user['id']}",
        headers={"Authorization": "Bearer token"},
        json={"external_id": "renamed-user", "display_name": "Still Ignored"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["external_id"] == "renamed-user"
    assert update_response.json()["display_name"] is None

    delete_response = await client.delete(
        f"/users/{created_user['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert delete_response.status_code == 204

    missing_response = await client.get(
        f"/users/{created_user['id']}",
        headers={"Authorization": "Bearer token"},
    )
    assert missing_response.status_code == 404
    assert missing_response.json() == {"detail": "User not found"}


@pytest.mark.asyncio
async def test_user_create_rejects_duplicate_external_id(
    client: AsyncClient,
    current_user: User,
) -> None:
    del current_user
    first_response = await client.post(
        "/users",
        headers={"Authorization": "Bearer token"},
        json={"external_id": "duplicate-user"},
    )
    second_response = await client.post(
        "/users",
        headers={"Authorization": "Bearer token"},
        json={"external_id": "duplicate-user"},
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json() == {"detail": "User external_id already exists"}


@pytest.mark.asyncio
async def test_user_list_searches_display_name_and_external_id_with_limit(
    client: AsyncClient,
    current_user: User,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    del current_user
    async with session_factory() as session:
        session.add_all(
            [
                User(externalId="amy-idp", display_name="Amy Atlas"),
                User(externalId="atlas-external", display_name="Jordan"),
                User(externalId="case-user", display_name="CASE Match"),
                User(externalId="other-user", display_name="Other Person"),
            ]
        )
        await session.commit()

    display_name_response = await client.get(
        "/users?q=atlas&limit=1",
        headers={"Authorization": "Bearer token"},
    )
    external_id_response = await client.get(
        "/users?q=external",
        headers={"Authorization": "Bearer token"},
    )
    case_response = await client.get(
        "/users?q=case",
        headers={"Authorization": "Bearer token"},
    )

    assert display_name_response.status_code == 200
    assert [user["external_id"] for user in display_name_response.json()] == [
        "amy-idp"
    ]
    assert external_id_response.status_code == 200
    assert [user["display_name"] for user in external_id_response.json()] == [
        "Jordan"
    ]
    assert case_response.status_code == 200
    assert [user["external_id"] for user in case_response.json()] == [
        "case-user"
    ]


@pytest.mark.asyncio
async def test_user_endpoints_require_authentication(client: AsyncClient) -> None:
    response = await client.get("/users")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}
