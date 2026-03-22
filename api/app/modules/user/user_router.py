from fastapi import APIRouter

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/me")
async def get_users_me():
    return {"id": "123", "first_name": "John", "last_name": "Doe"}
