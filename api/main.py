from fastapi import FastAPI
from app.modules.user.user_router import user_router

app = FastAPI()

app.include_router(user_router)
