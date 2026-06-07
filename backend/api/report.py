"""Learning Report API endpoint."""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException, Request
from backend.core.auth import require_auth
from backend.models.schemas import ReportResponse
from utils.db import get_session, get_session_messages, get_session_scores, get_session_corrections, get_error_type_stats
from modules.report import ReportData, generate_report

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/{session_id}", response_model=ReportResponse)
async def get_report(session_id: int):
    """Generate a comprehensive learning report for a completed session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return await _build_report(session)


@router.get("/active/latest", response_model=ReportResponse)
async def get_latest_ended_report(request: Request):
    """Get the report for the current user's most recently ended session."""
    user = require_auth(request)
    user_id = int(user["sub"])

    from utils.db import get_user_sessions
    sessions = get_user_sessions(user_id, limit=1)
    ended = [s for s in sessions if s["status"] == "ended"]
    if not ended:
        raise HTTPException(status_code=404, detail="No completed sessions found. End a session first.")

    return await _build_report(ended[0])


async def _build_report(session: dict) -> ReportResponse:
    session_id = session["id"]

    # Fetch related data
    messages = get_session_messages(session_id)
    scores = get_session_scores(session_id)
    corrections = get_session_corrections(session_id)
    error_stats = get_error_type_stats(session_id)

    data = ReportData(
        session_id=session_id,
        scene_name=session["scene_name"],
        difficulty=session["difficulty"],
        model=session["model"],
        total_rounds=session["total_rounds"],
        avg_pronunciation_score=session["avg_pronunciation_score"],
        created_at=str(session.get("created_at", "")),
        ended_at=str(session.get("ended_at", "")),
        messages=messages,
        scores=scores,
        corrections=corrections,
        error_stats=error_stats,
    )

    # Run LLM analysis in thread pool (sync call)
    data = await asyncio.to_thread(generate_report, data)

    # Build score history
    score_history = [
        {"round": i + 1, "score": round(s["overall_score"], 1)}
        for i, s in enumerate(scores) if s.get("overall_score")
    ]

    return ReportResponse(
        session_id=data.session_id,
        scene_name=data.scene_name,
        difficulty=data.difficulty,
        model=data.model,
        total_rounds=data.total_rounds,
        avg_pronunciation_score=round(data.avg_pronunciation_score, 1),
        created_at=data.created_at,
        ended_at=data.ended_at,
        message_count=len(data.messages),
        score_count=len(data.scores),
        correction_count=len(data.corrections),
        error_stats=data.error_stats,
        score_history=score_history,
        summary=data.summary,
        strengths=data.strengths,
        weaknesses=data.weaknesses,
        suggestions=data.suggestions,
        topics_covered=data.topics_covered,
        level_assessment=data.level_assessment,
    )
