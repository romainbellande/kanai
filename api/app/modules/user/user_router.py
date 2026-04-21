from fastapi import APIRouter, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_scheme = HTTPBearer()

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/me")
async def get_users_me(
    _: HTTPAuthorizationCredentials = Security(bearer_scheme),
):
    return {"id": "123", "first_name": "John", "last_name": "Doe"}
