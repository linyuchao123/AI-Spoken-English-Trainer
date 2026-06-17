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

    In both paths, sentence_analyses are enriched with Chivox phoneme-level
    pronunciation scores from the pronunciation_scores table.
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
    # Top-level JSON fields (summary, strengths, etc.) — parsed from evaluation_json
    json_summary = ""
    json_summary_cn = ""
    json_strengths: list = []
    json_weaknesses: list = []
    json_suggestions: list = []
    if evaluation:
        raw_json = evaluation.get("evaluation_json")
        if raw_json:
            try:
                parsed = _json.loads(raw_json) if isinstance(raw_json, str) else raw_json
                cached_report = parsed.get("report")
                # Extract top-level fields from parsed JSON (NOT from eval_dict SQL columns)
                json_summary = parsed.get("summary", "")
                json_summary_cn = parsed.get("summary_cn", "")
                json_strengths = parsed.get("strengths", [])
                json_weaknesses = parsed.get("weaknesses", [])
                json_suggestions = parsed.get("suggestions", [])
            except Exception:
                pass

    # Build score history (same for both paths)
    score_history = [
        ScorePoint(round=i + 1, score=round(s["overall_score"], 1))
        for i, s in enumerate(scores) if s.get("overall_score")
    ]

    # ── Build Chivox score lookup keyed by user message sequence index ──────────
    chivox_lookup = _build_chivox_lookup(messages, scores)

    # ── Path A: Use LangGraph-cached report (no LLM call) ──────────────────────
    if cached_report:
        raw_sentence_analyses = [
            {
                "message_index": sa.get("message_index", i),
                "original_en": sa.get("original_en", ""),
                "translation_cn": sa.get("translation_cn", ""),
                "pronunciation_issues": sa.get("pronunciation_issues", []),
                "grammar_issues": sa.get("grammar_issues", []),
                "expression_improvements": sa.get("expression_improvements", []),
            }
            for i, sa in enumerate(cached_report.get("sentence_analyses", []))
        ]

        sentence_analyses = _enrich_with_chivox(raw_sentence_analyses, chivox_lookup)

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
            summary=json_summary,
            summary_cn=json_summary_cn,
            strengths=json_strengths,
            weaknesses=json_weaknesses,
            suggestions=json_suggestions,
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

    raw_sentence_analyses = [
        {
            "message_index": a.message_index,
            "original_en": a.original_en,
            "translation_cn": a.translation_cn,
            "pronunciation_issues": a.pronunciation_issues,
            "grammar_issues": a.grammar_issues,
            "expression_improvements": a.expression_improvements,
        }
        for a in data.sentence_analyses
    ]
    sentence_analyses = _enrich_with_chivox(raw_sentence_analyses, chivox_lookup)

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


# ============================================================
# Chivox enrichment helpers
# ============================================================

def _build_chivox_lookup(messages: list[dict], scores: list[dict]) -> dict[int, dict]:
    """
    Build a lookup dict mapping user message sequence index → Chivox score data.

    The sentence_analyses use message_index to reference which user utterance
    (by order, 0-based) they correspond to. We match Chivox scores by finding
    the pronunciation_scores row for each user message and mapping it to
    the user message's sequential index.
    """
    # Index scores by message_id
    scores_by_msg: dict[int, dict] = {}
    for s in scores:
        scores_by_msg[s["message_id"]] = dict(s)

    lookup: dict[int, dict] = {}
    user_idx = 0
    for m in messages:
        if m["role"] != "user":
            continue
        msg_id = m["id"]
        if msg_id in scores_by_msg:
            s = scores_by_msg[msg_id]
            # Parse error_details for phoneme highlights
            phoneme_issues = []
            err_details = s.get("error_details")
            if err_details:
                try:
                    import json as _json
                    parsed = _json.loads(err_details) if isinstance(err_details, str) else err_details
                    phoneme_issues = parsed.get("phoneme_highlights", []) if isinstance(parsed, dict) else []
                except Exception:
                    pass

            lookup[user_idx] = {
                "chivox_score": round(s.get("overall_score", 0), 1),
                "chivox_phoneme_issues": phoneme_issues,
            }
        user_idx += 1

    return lookup


def _enrich_with_chivox(
    raw_analyses: list[dict],
    chivox_lookup: dict[int, dict],
) -> list[SentenceAnalysisItem]:
    """
    Merge Chivox phoneme-level scores into sentence analysis items.
    """
    enriched = []
    for sa in raw_analyses:
        msg_idx = sa.get("message_index", 0)
        chivox_data = chivox_lookup.get(msg_idx, {})
        enriched.append(SentenceAnalysisItem(
            message_index=msg_idx,
            original_en=sa.get("original_en", ""),
            translation_cn=sa.get("translation_cn", ""),
            pronunciation_issues=sa.get("pronunciation_issues", []),
            grammar_issues=sa.get("grammar_issues", []),
            expression_improvements=sa.get("expression_improvements", []),
            chivox_score=chivox_data.get("chivox_score", 0),
            chivox_phoneme_issues=chivox_data.get("chivox_phoneme_issues", []),
        ))
    return enriched
