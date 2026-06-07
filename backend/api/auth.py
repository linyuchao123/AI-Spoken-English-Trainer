"""
Auth API routes: register, login, logout, me, GitHub OAuth.
"""

import sys
import os
import requests
from typing import Optional
from urllib.parse import quote, urlencode

# Add project root to path so we can import config/utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Load .env before reading env vars
from dotenv import load_dotenv
load_dotenv()

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
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
from utils.db import create_user, authenticate_user, get_user_by_id, get_or_create_oauth_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# GitHub OAuth configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/auth/github/callback")


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


# ============================================================
# GitHub OAuth Endpoints
# ============================================================

@router.get("/github/login")
async def github_login():
    """Redirect user to GitHub OAuth authorization page."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured.")

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "user:email",
    }
    github_auth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url=github_auth_url)


@router.get("/github/callback")
async def github_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    response: Response = None,  # type: ignore[assignment]
):
    """Handle GitHub OAuth callback, create/login user, set auth cookie."""
    # Handle user denying authorization
    if error:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/login?error={quote(error_description or error)}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured.")

    # Exchange code for access token
    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": GITHUB_REDIRECT_URI,
        },
        headers={"Accept": "application/json"},
        timeout=15,
    )
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub authentication failed.")

    # Get user info from GitHub
    user_resp = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    user_data = user_resp.json()

    github_id = str(user_data.get("id", ""))
    username = user_data.get("login", "github_user")
    avatar_url = user_data.get("avatar_url", "")

    # Get email (may be private)
    email = user_data.get("email", "")
    if not email:
        emails_resp = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        emails = emails_resp.json()
        primary_email = next((e["email"] for e in emails if e.get("primary")), None)
        if primary_email:
            email = primary_email
        else:
            email = f"{github_id}@github.user"

    if not github_id:
        raise HTTPException(status_code=401, detail="Failed to get GitHub user info.")

    # Create or get user
    user_id = get_or_create_oauth_user("github", github_id, email, username, avatar_url)
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create user.")

    user = get_user_by_id(user_id)
    token = create_token(user_id, user["email"], user["username"])
    set_auth_cookie(response, token)

    # Redirect to frontend home page
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(url=f"{frontend_url}/practice")
