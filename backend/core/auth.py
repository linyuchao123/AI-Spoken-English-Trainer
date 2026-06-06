"""
JWT authentication utilities for the FastAPI backend.
"""

import jwt
import os
import datetime
from fastapi import Request, HTTPException, Response
from typing import Optional

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days
COOKIE_NAME = "auth_token"


def create_token(user_id: int, email: str, username: str) -> str:
    """Create a JWT token for the given user."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.datetime.now(datetime.timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token. Returns payload dict or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user_from_request(request: Request) -> Optional[dict]:
    """Extract and decode JWT from request cookies."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return decode_token(token)


def require_auth(request: Request) -> dict:
    """Require authentication. Raises 401 if not authenticated."""
    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def set_auth_cookie(response: Response, token: str):
    """Set the JWT token as an HTTP-only cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
