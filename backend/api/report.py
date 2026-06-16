"""
Learning Report API endpoint.

When the session was ended using the LangGraph evaluation pipeline, the full
report data (level_assessment, sentence_analyses, topics_covered, etc.) is
already stored inside the evaluation_json.report field.  In that case this
endpoint simply reads the cached data — no extra LLM call is needed.

For sessions evaluated with the legacy evaluate_session() path, this endpoint
falls back to calling generate_report() which makes a fresh LLM call.
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException, Request
from backend.core.auth import require_auth
from backend.models.schemas import ReportResponse, ScorePoint, SentenceAnalysisItem, ScoreBreakdown
from utils.db import (
    get_session,
    get_session_messages,
    get_session_scores,
    get_session_corrections,
    get_error_type_stats,
    get_session_evaluation,
)
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
    """
    Build the report response.

    Priority:
    1. If evaluation_json contains a "report" field (LangGraph pipeline output),
       use it directly — no extra LLM call.
    2. Otherwise fall back to calling generate_report() (legacy path).
    """
    session_id = session["id"]

    # Fetch related data
    messages = get_session_messages(session_id)
    scores = get_session_scores(session_id)
    corrections = get_session_corrections(session_id)
    error_stats = get_error_type_stats(session_id)
    evaluation = get_session_evaluation(session_id)

    eval_dict = dict(evaluation) if evaluation else {}

    # ── Check for LangGraph-cached report ──────────────────────────────────────
    import json as _json

    cached_report = None
    if evaluation:
        raw_json = evaluation.get("evaluation_json")
        if raw_json:
            try:
                parsed = _json.loads(raw_json) if isinstance(raw_json, str) else raw_json
                cached_report = parsed.get("report")
            except Exception:
                pass

    # Build score history (same for both paths)
    score_history = [
        ScorePoint(round=i + 1, score=round(s["overall_score"], 1))
        for i, s in enumerate(scores) if s.get("overall_score")
    ]

    # ── Path A: Use LangGraph-cached report (no LLM call) ──────────────────────
    if cached_report:
        sentence_analyses = [
            SentenceAnalysisItem(
                message_index=sa.get("message_index", i),
                original_en=sa.get("original_en", ""),
                translation_cn=sa.get("translation_cn", ""),
                pronunciation_issues=sa.get("pronunciation_issues", []),
                grammar_issues=sa.get("grammar_issues", []),
                expression_improvements=sa.get("expression_improvements", []),
            )
            for i, sa in enumerate(cached_report.get("sentence_analyses", []))
        ]

        score_breakdown = ScoreBreakdown(
            grammar_score=round(eval_dict.get("grammar_score", 0), 1),
            vocabulary_score=round(eval_dict.get("vocabulary_score", 0), 1),
            fluency_score=round(eval_dict.get("fluency_score", 0), 1),
            expression_score=round(eval_dict.get("expression_score", 0), 1),
            naturalness_score=round(eval_dict.get("naturalness_score", 0), 1),
            emotion_score=round(eval_dict.get("emotion_score", 0), 1),
        )

        return ReportResponse(
            session_id=session_id,
            scene_name=session["scene_name"],
            difficulty=session["difficulty"],
            model=session["model"],
            total_rounds=session["total_rounds"],
            avg_pronunciation_score=round(session.get("avg_pronunciation_score", 0), 1),
            created_at=str(session.get("created_at", "")),
            ended_at=str(session.get("ended_at", "")),
            message_count=len(messages),
            score_count=len(scores),
            correction_count=len(corrections),
            error_stats=error_stats,
            score_history=score_history,
            score_breakdown=score_breakdown,
            summary=eval_dict.get("summary", ""),
            summary_cn=cached_report.get("summary_cn", eval_dict.get("summary_cn", "")),
            strengths=eval_dict.get("strengths", []),
            weaknesses=eval_dict.get("weaknesses", []),
            suggestions=eval_dict.get("suggestions", []),
            topics_covered=cached_report.get("topics_covered", []),
            level_assessment=cached_report.get("level_assessment", ""),
            level_assessment_cn=cached_report.get("level_assessment_cn", ""),
            sentence_analyses=sentence_analyses,
        )

    # ── Path B: Legacy path — call generate_report() (fresh LLM call) ──────────
    data = ReportData(
        session_id=session_id,
        scene_name=session["scene_name"],
        difficulty=session["difficulty"],
        model=session["model"],
        total_rounds=session["total_rounds"],
        avg_pronunciation_score=session["avg_pronunciation_score"],
        created_at=str(session.get("created_at", "")),
        ended_at=str(session.get("ended_at", "")),
        messages=[dict(m) for m in messages],
        scores=[dict(s) for s in scores],
        corrections=[dict(c) for c in corrections],
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

    score_breakdown = ScoreBreakdown(
        grammar_score=round(data.grammar_score, 1),
        vocabulary_score=round(data.vocabulary_score, 1),
        fluency_score=round(data.fluency_score, 1),
        expression_score=round(data.expression_score, 1),
        naturalness_score=round(data.naturalness_score, 1),
        emotion_score=round(data.emotion_score, 1),
    )

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
