"""
Sessions API: create, list, end sessions and manage messages.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Request, HTTPException
from backend.core.auth import require_auth
from backend.models.schemas import (
    CreateSessionRequest,
    SessionResponse,
    SendMessageRequest,
    MessageResponse,
)
from utils.db import (
    create_session,
    end_session,
    get_session,
    get_user_sessions,
    get_active_session,
    get_session_messages,
    add_message,
)
from config.settings import SCENES

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _session_to_response(s: dict) -> SessionResponse:
    return SessionResponse(
        id=s["id"],
        scene_key=s["scene_key"],
        scene_name=s["scene_name"],
        difficulty=s["difficulty"],
        model=s["model"],
        status=s["status"],
        total_rounds=s["total_rounds"],
        avg_pronunciation_score=s["avg_pronunciation_score"],
        created_at=str(s["created_at"]) if s.get("created_at") else None,
        ended_at=str(s["ended_at"]) if s.get("ended_at") else None,
    )


@router.post("", response_model=SessionResponse)
async def create_new_session(req: CreateSessionRequest, request: Request):
    """Create a new practice session."""
    user = require_auth(request)
    user_id = int(user["sub"])

    scene = SCENES.get(req.scene_key)
    if not scene:
        raise HTTPException(status_code=400, detail="Invalid scene key.")

    # End any existing active session
    active = get_active_session(user_id)
    if active:
        end_session(active["id"])

    session_id = create_session(
        scene_key=req.scene_key,
        scene_name=scene["name"],
        difficulty=req.difficulty,
        model=req.model,
        user_id=user_id,
    )

    session = get_session(session_id)
    return _session_to_response(session)


@router.get("", response_model=list[SessionResponse])
async def list_sessions(request: Request, limit: int = 20):
    """List user's sessions."""
    user = require_auth(request)
    user_id = int(user["sub"])

    sessions = get_user_sessions(user_id, limit=limit)
    return [_session_to_response(s) for s in sessions]


@router.get("/active", response_model=SessionResponse | None)
async def get_active(request: Request):
    """Get the user's current active session."""
    user = require_auth(request)
    user_id = int(user["sub"])

    session = get_active_session(user_id)
    if not session:
        return None
    return _session_to_response(session)


@router.patch("/{session_id}/end", response_model=SessionResponse)
async def end_current_session(session_id: int, request: Request):
    """End a practice session."""
    require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active.")

    end_session(session_id)
    session = get_session(session_id)
    return _session_to_response(session)


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(session_id: int, request: Request):
    """Get all messages for a session."""
    require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    messages = get_session_messages(session_id)
    return [
        MessageResponse(
            id=m["id"],
            role=m["role"],
            content=m["content"],
            created_at=str(m["created_at"]) if m.get("created_at") else None,
        )
        for m in messages
    ]


@router.post("/{session_id}/messages", response_model=list[MessageResponse])
async def send_message(session_id: int, req: SendMessageRequest, request: Request):
    """Send a message and get an AI response (placeholder)."""
    user = require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active.")

    # Add user message
    user_msg_id = add_message(session_id, "user", req.content)

    # Placeholder AI response (will be replaced with actual LLM call later)
    ai_response = f"[AI Placeholder] You said: \"{req.content}\". AI conversation will be implemented in a future update."
    ai_msg_id = add_message(session_id, "ai", ai_response)

    messages = get_session_messages(session_id)
    return [
        MessageResponse(
            id=m["id"],
            role=m["role"],
            content=m["content"],
            created_at=str(m["created_at"]) if m.get("created_at") else None,
        )
        for m in messages
    ]
