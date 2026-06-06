"""
Auth API routes: register, login, logout, me.
"""

import sys
import os

# Add project root to path so we can import config/utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Request, Response, HTTPException
from backend.core.auth import (
    create_token,
    set_auth_cookie,
    clear_auth_cookie,
    require_auth,
)
from backend.models.schemas import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    AuthResponse,
)
from utils.db import create_user, authenticate_user, get_user_by_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, response: Response):
    """Register a new user and auto-login."""
    if not req.email or not req.username or not req.password:
        raise HTTPException(status_code=400, detail="All fields are required.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    if "@" not in req.email or "." not in req.email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    user_id = create_user(req.email, req.username, req.password)
    if not user_id:
        raise HTTPException(status_code=409, detail="This email is already registered.")

    user = get_user_by_id(user_id)
    token = create_token(user_id, user["email"], user["username"])
    set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            username=user["username"],
            avatar_url=user.get("avatar_url", ""),
        ),
        message="Registration successful!",
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, response: Response):
    """Login with email and password."""
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user["id"], user["email"], user["username"])
    set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            username=user["username"],
            avatar_url=user.get("avatar_url", ""),
        ),
        message="Login successful!",
    )


@router.post("/logout")
async def logout(response: Response):
    """Logout by clearing the auth cookie."""
    clear_auth_cookie(response)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
async def me(request: Request):
    """Get the currently authenticated user."""
    token_user = require_auth(request)
    user_id = int(token_user["sub"])
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return UserResponse(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        avatar_url=user.get("avatar_url", ""),
    )
