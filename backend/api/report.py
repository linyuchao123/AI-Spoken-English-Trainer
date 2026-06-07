"""Learning Report API endpoint."""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException, Request
from backend.core.auth import require_auth
from backend.models.schemas import ReportResponse, ScorePoint, SentenceAnalysisItem, ScoreBreakdown
from utils.db import get_session, get_session_messages, get_session_scores, get_session_corrections, get_error_type_stats, get_session_evaluation
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
    evaluation = get_session_evaluation(session_id)

    # Extract evaluation scores
    eval_dict = dict(evaluation) if evaluation else {}

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
        grammar_score=eval_dict.get("grammar_score", 0),
        vocabulary_score=eval_dict.get("vocabulary_score", 0),
        fluency_score=eval_dict.get("fluency_score", 0),
        expression_score=eval_dict.get("expression_score", 0),
        naturalness_score=eval_dict.get("naturalness_score", 0),
        emotion_score=eval_dict.get("emotion_score", 0),
    )

    # Run LLM analysis in thread pool (sync call)
    data = await asyncio.to_thread(generate_report, data)

    # Build score history
    score_history = [
        ScorePoint(round=i + 1, score=round(s["overall_score"], 1))
        for i, s in enumerate(scores) if s.get("overall_score")
    ]

    # Build score breakdown
    score_breakdown = ScoreBreakdown(
        grammar_score=round(data.grammar_score, 1),
        vocabulary_score=round(data.vocabulary_score, 1),
        fluency_score=round(data.fluency_score, 1),
        expression_score=round(data.expression_score, 1),
        naturalness_score=round(data.naturalness_score, 1),
        emotion_score=round(data.emotion_score, 1),
    )

    # Build sentence analyses
    sentence_analyses = [
        SentenceAnalysisItem(
            message_index=a.message_index,
            original_en=a.original_en,
            translation_cn=a.translation_cn,
            pronunciation_issues=a.pronunciation_issues,
            grammar_issues=a.grammar_issues,
            expression_improvements=a.expression_improvements,
        )
        for a in data.sentence_analyses
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
        score_breakdown=score_breakdown,
        summary=data.summary,
        summary_cn=data.summary_cn,
        strengths=data.strengths,
        weaknesses=data.weaknesses,
        suggestions=data.suggestions,
        topics_covered=data.topics_covered,
        level_assessment=data.level_assessment,
        level_assessment_cn=data.level_assessment_cn,
        sentence_analyses=sentence_analyses,
    )
