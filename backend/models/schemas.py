"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


# ============================================================
# Auth Schemas
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str = ""


class AuthResponse(BaseModel):
    user: UserResponse
    message: str = "Success"


# ============================================================
# Scene Schemas
# ============================================================

class SceneResponse(BaseModel):
    key: str
    name: str
    icon: str
    description: str


class DifficultyResponse(BaseModel):
    key: str
    name: str
    color: str


class ModelResponse(BaseModel):
    key: str
    name: str
    icon: str
    description: str


class ScenesConfigResponse(BaseModel):
    scenes: list[SceneResponse]
    difficulties: list[DifficultyResponse]
    models: list[ModelResponse]


# ============================================================
# Session Schemas
# ============================================================

class CreateSessionRequest(BaseModel):
    scene_key: str
    difficulty: str
    model: str = "openai"


class SessionResponse(BaseModel):
    id: int
    scene_key: str
    scene_name: str
    difficulty: str
    model: str
    status: str
    total_rounds: int = 0
    avg_pronunciation_score: float = 0.0
    created_at: Optional[str] = None
    ended_at: Optional[str] = None


# ============================================================
# Message Schemas
# ============================================================

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: Optional[str] = None
