"""
Sessions API: create, list, end sessions and manage messages.
"""

import asyncio
import sys
import os
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Request, HTTPException
from backend.core.auth import require_auth
from backend.models.schemas import (
    CreateSessionRequest,
    SessionResponse,
    SendMessageRequest,
    MessageResponse,
    SessionDetailResponse,
    DetailMessage,
    DetailPronunciation,
    DetailGrammar,
    WordScoreResponse,
    PronunciationResponse,
    EvaluationResponse,
    RealtimeFeedbackResponse,
    RealtimeGrammarError,
    RealtimeExpressionSuggestion,
    SendMessageResponse,
)
from utils.db import (
    create_session,
    end_session,
    get_session,
    get_user_sessions,
    get_active_session,
    get_session_messages,
    get_session_scores,
    get_session_corrections,
    get_session_evaluation,
    get_connection,
    add_message,
    add_pronunciation_score,
    delete_session,
    save_session_evaluation,
)
from config.settings import SCENES
from modules.llm import generate_reply, generate_opening
from modules.evaluation import evaluate_session
from modules.agents import run_evaluation_pipeline, run_realtime_feedback

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _session_to_response(s: dict) -> SessionResponse:
    return SessionResponse(
        id=s["id"],
        scene_key=s["scene_key"],
        scene_name=s["scene_name"],
        difficulty=s["difficulty"],
        model=s["model"],
        training_mode=s.get("training_mode", "immersive"),
        status=s["status"],
        total_rounds=s["total_rounds"],
        avg_pronunciation_score=s["avg_pronunciation_score"],
        created_at=str(s["created_at"]) if s.get("created_at") else None,
        ended_at=str(s["ended_at"]) if s.get("ended_at") else None,
    )


@router.post("", response_model=SessionResponse)
async def create_new_session(req: CreateSessionRequest, request: Request):
    """Create a new practice session with a dynamic AI opening greeting."""
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
        training_mode=req.training_mode,
        user_id=user_id,
    )

    # ── Generate AI opening greeting dynamically per model ──────────
    try:
        opening = generate_opening(
            scene_key=req.scene_key,
            difficulty=req.difficulty,
            model_key=req.model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM service error: {str(exc)}. Please try again or switch model.",
        )

    add_message(session_id, "ai", opening)

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
    """End a practice session and run LLM multi-dimension evaluation."""
    require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active.")

    end_session(session_id)

    # ── Run LangGraph evaluation pipeline ────────────────────────────
    # This 4-node agent workflow runs:
    #   grammar_analyst -> pronunciation_analyst -> comprehensive_evaluator
    #   -> report_generator
    # On failure it falls back to the legacy synchronous evaluate_session().
    try:
        messages = get_session_messages(session_id)
        pronunciation_scores = [dict(s) for s in get_session_scores(session_id)]

        session_info = {
            "scene_name": session["scene_name"],
            "difficulty": session["difficulty"],
            "model": session["model"],
            "total_rounds": session.get("total_rounds", 0),
        }

        pipeline_result = await asyncio.to_thread(
            run_evaluation_pipeline,
            messages=[dict(m) for m in messages],
            session_info=session_info,
            pronunciation_scores=pronunciation_scores,
        )

        # ── Extract scores from comprehensive_evaluator output ────────
        eval_scores = pipeline_result.get("evaluation_scores", {})
        report_data = pipeline_result.get("report", {})

        # ── Build enriched evaluation_json (includes report for later use) ──
        enriched_json = {
            "summary": eval_scores.get("summary", ""),
            "summary_cn": eval_scores.get("summary_cn", ""),
            "strengths": eval_scores.get("strengths", []),
            "weaknesses": eval_scores.get("weaknesses", []),
            "suggestions": eval_scores.get("suggestions", []),
            # ── Report data (used by /api/report/{id} endpoint) ───────
            "report": {
                "level_assessment": report_data.get("level_assessment", ""),
                "level_assessment_cn": report_data.get("level_assessment_cn", ""),
                "topics_covered": report_data.get("topics_covered", []),
                "sentence_analyses": [
                    {
                        "message_index": sa.get("message_index", 0),
                        "original_en": sa.get("original_en", ""),
                        "translation_cn": sa.get("translation_cn", ""),
                        "pronunciation_issues": sa.get("pronunciation_issues", []),
                        "grammar_issues": sa.get("grammar_issues", []),
                        "expression_improvements": sa.get("expression_improvements", []),
                    }
                    for sa in report_data.get("sentence_analyses", [])
                ],
            },
        }

        save_session_evaluation(
            session_id=session_id,
            overall_score=eval_scores.get("overall_score", 50),
            grammar_score=eval_scores.get("grammar_score", 50),
            vocabulary_score=eval_scores.get("vocabulary_score", 50),
            fluency_score=eval_scores.get("fluency_score", 50),
            expression_score=eval_scores.get("expression_score", 50),
            naturalness_score=eval_scores.get("naturalness_score", 50),
            emotion_score=eval_scores.get("emotion_score", 50),
            evaluation_json=enriched_json,
        )

        # Update session avg_pronunciation_score with evaluation overall
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sessions SET avg_pronunciation_score = ? WHERE id = ?",
            (eval_scores.get("overall_score", 50), session_id),
        )
        conn.commit()
        conn.close()

        logger.info("LangGraph evaluation pipeline completed for session %d", session_id)

    except Exception as exc:
        # ── Fallback to legacy synchronous evaluation ─────────────────
        logger.warning(
            "LangGraph pipeline failed (%s), falling back to legacy evaluation.", exc
        )
        try:
            messages = get_session_messages(session_id)
            eval_result = evaluate_session(
                messages=[dict(m) for m in messages],
                scene_name=session["scene_name"],
                difficulty=session["difficulty"],
                total_rounds=session.get("total_rounds", 0),
            )
            save_session_evaluation(
                session_id=session_id,
                overall_score=eval_result.overall_score,
                grammar_score=eval_result.grammar_score,
                vocabulary_score=eval_result.vocabulary_score,
                fluency_score=eval_result.fluency_score,
                expression_score=eval_result.expression_score,
                naturalness_score=eval_result.naturalness_score,
                emotion_score=eval_result.emotion_score,
                evaluation_json={
                    "summary": eval_result.summary,
                    "strengths": eval_result.strengths,
                    "weaknesses": eval_result.weaknesses,
                    "suggestions": eval_result.suggestions,
                },
            )
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE sessions SET avg_pronunciation_score = ? WHERE id = ?",
                (eval_result.overall_score, session_id),
            )
            conn.commit()
            conn.close()
        except Exception as exc2:
            logger.warning("Legacy evaluation also skipped: %s", exc2)

    session = get_session(session_id)
    return _session_to_response(session)


@router.delete("/{session_id}")
async def delete_one_session(session_id: int, request: Request):
    """Delete a session and all related data."""
    require_auth(request)

    if not delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"ok": True}


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


@router.post("/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(session_id: int, req: SendMessageRequest, request: Request):
    """Send a user message and get an AI reply via the LLM conversation engine.

    In 'realtime' training mode, also runs per-message grammar/expression
    analysis and returns real-time feedback alongside the messages.

    When audio_base64 is provided, also runs Chivox MCP phoneme-level
    pronunciation assessment concurrently with AI reply generation.
    """
    user = require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active.")

    # 1. Persist user message
    user_msg_id = add_message(session_id, "user", req.content)

    # 1.5 ── Pronunciation Assessment (Chivox MCP, runs concurrently with LLM) ──
    pron_task = None
    if req.audio_base64 and req.audio_base64.strip():
        pron_task = asyncio.create_task(
            asyncio.to_thread(
                _run_pronunciation_assessment,
                audio_base64=req.audio_base64,
                reference_text=req.content,
                session_id=session_id,
                message_id=user_msg_id,
            )
        )

    # 2. Build conversation history (last 20 messages for context)
    all_messages = get_session_messages(session_id)
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in all_messages[-20:]
    ]

    # 3. Generate AI reply via LLM
    try:
        ai_response = generate_reply(
            messages_history=history,
            scene_key=session["scene_key"],
            difficulty=session["difficulty"],
            model_key=session["model"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM service error: {str(exc)}. Please try again or switch model.",
        )

    # 4. Persist AI response
    add_message(session_id, "ai", ai_response)

    # 4.5 ── Collect pronunciation result (awaited after AI reply to maximise concurrency) ──
    pronunciation: Optional[PronunciationResponse] = None
    if pron_task is not None:
        try:
            pronunciation = await pron_task
        except Exception as exc:
            logger.warning("[send_message] Pronunciation assessment failed: %s", exc)
            pronunciation = None

    # 5. ── Real-time feedback (realtime mode only) ──────────────────
    feedback: Optional[RealtimeFeedbackResponse] = None
    training_mode = session.get("training_mode", "immersive")

    if training_mode == "realtime":
        from modules.agents.realtime_feedback_graph import RealtimeFeedbackOutput
        try:
            rt_result: RealtimeFeedbackOutput = await asyncio.to_thread(
                run_realtime_feedback,
                user_message=req.content,
                difficulty=session["difficulty"],
            )
            feedback = RealtimeFeedbackResponse(
                has_errors=rt_result.has_errors,
                overall_score=rt_result.overall_score,
                corrected_sentence=rt_result.corrected_sentence,
                grammar_errors=[
                    RealtimeGrammarError(
                        original_text=e.original_text,
                        corrected_text=e.corrected_text,
                        error_type=e.error_type,
                        explanation=e.explanation,
                        explanation_cn=e.explanation_cn,
                    )
                    for e in rt_result.grammar_errors
                ],
                expression_suggestions=[
                    RealtimeExpressionSuggestion(
                        original_phrase=s.original_phrase,
                        improved_phrase=s.improved_phrase,
                        explanation=s.explanation,
                        explanation_cn=s.explanation_cn,
                    )
                    for s in rt_result.expression_suggestions
                ],
                summary_cn=rt_result.summary_cn,
            )
            logger.info(
                "[send_message] Real-time feedback: score=%.0f, errors=%d, suggestions=%d",
                rt_result.overall_score,
                len(rt_result.grammar_errors),
                len(rt_result.expression_suggestions),
            )
        except Exception as exc:
            logger.warning("[send_message] Real-time feedback failed: %s", exc)
            # Feedback failure is non-fatal — return messages without feedback
            feedback = None

    # 6. Return full message list + optional feedback + pronunciation
    messages = get_session_messages(session_id)
    return SendMessageResponse(
        messages=[
            MessageResponse(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                created_at=str(m["created_at"]) if m.get("created_at") else None,
            )
            for m in messages
        ],
        feedback=feedback,
        pronunciation=pronunciation,
    )


def _run_pronunciation_assessment(
    audio_base64: str,
    reference_text: str,
    session_id: int,
    message_id: int,
):
    """Run Chivox MCP pronunciation assessment and save to DB.

    Called in a background thread via asyncio.to_thread().
    Chivox is the primary engine; falls back to LLM text comparison
    if Chivox is unavailable or returns an error.

    Returns:
        PronunciationResponse or None on failure
    """
    from modules.pronunciation import assess_audio

    result = assess_audio(
        audio_base64=audio_base64,
        reference_text=reference_text,
        recognized_text=reference_text,
        accent="en-US",
    )

    if result.error and not result.overall_score:
        logger.warning(
            "[pronunciation] Assessment returned error (no score): %s", result.error
        )
        return None

    # Save to database
    try:
        error_details = {
            "words": [
                {
                    "word": w.word,
                    "accuracy_score": round(w.accuracy_score, 1),
                    "error_type": w.error_type,
                    "expected_pronunciation": w.expected_pronunciation,
                    "correction_cn": w.correction_cn,
                }
                for w in result.words
            ],
            "phoneme_highlights": result.phoneme_highlights,
            "stress_score": round(result.stress_score, 1),
            "intonation_score": round(result.intonation_score, 1),
            "rhythm_score": round(result.rhythm_score, 1),
        }
        add_pronunciation_score(
            session_id=session_id,
            message_id=message_id,
            overall_score=round(result.overall_score, 1),
            accuracy_score=round(result.accuracy_score, 1),
            fluency_score=round(result.fluency_score, 1),
            completeness_score=round(result.completeness_score, 1),
            error_details=error_details,
        )
        logger.info(
            "[pronunciation] Saved Chivox score: overall=%.0f, msg=%d",
            result.overall_score, message_id,
        )
    except Exception as exc:
        logger.warning("[pronunciation] DB save failed: %s", exc)

    # Build Pydantic response
    return PronunciationResponse(
        accuracy_score=round(result.accuracy_score, 1),
        fluency_score=round(result.fluency_score, 1),
        completeness_score=round(result.completeness_score, 1),
        overall_score=round(result.overall_score, 1),
        stress_score=round(result.stress_score, 1),
        intonation_score=round(result.intonation_score, 1),
        rhythm_score=round(result.rhythm_score, 1),
        words=[
            WordScoreResponse(
                word=w.word,
                accuracy_score=round(w.accuracy_score, 1),
                error_type=w.error_type,
                expected_pronunciation=w.expected_pronunciation,
                correction_cn=w.correction_cn,
            )
            for w in result.words
        ],
        phoneme_highlights=result.phoneme_highlights,
        summary_en=result.summary_en,
        summary_cn=result.summary_cn,
        suggestions=result.suggestions,
        error=result.error,
    )


# ============================================================
# Session Detail (history review with translations + scores)
# ============================================================

import json as _json
import logging
logger = logging.getLogger(__name__)


def _translate_messages(messages: list[dict]) -> dict[int, str]:
    """Batch-translate English messages to Chinese via LLM.
    Returns {message_id: chinese_translation}."""
    if not messages:
        return {}

    # Build a numbered list of messages
    lines = []
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher"
        lines.append(f"[{m['id']}|{role_label}]: {m['content'][:300]}")

    prompt = (
        "Translate the following English conversation messages into natural Chinese. "
        "Return ONLY a JSON object mapping each message ID to its Chinese translation. "
        "Keep the translations natural and conversational, matching the tone of each speaker.\n\n"
        + "\n".join(lines) + "\n\n"
        + 'Example output: {"1": "你好，欢迎参加面试。", "2": "谢谢，很高兴来到这里。"}'
    )

    try:
        # Try DeepSeek first
        from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, OPENAI_API_KEY
        if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500, temperature=0.2,
            )
        elif OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-your-"):
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500, temperature=0.2,
            )
        else:
            return {}

        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        translations = _json.loads(raw)
        # Convert string keys to int
        return {int(k): v for k, v in translations.items()}
    except Exception as exc:
        logger.warning("Translation failed: %s", exc)
        return {}


@router.get("/{session_id}/detail", response_model=SessionDetailResponse)
async def get_session_detail(session_id: int, request: Request):
    """Get full session detail: messages with pronunciation, grammar, and Chinese translations."""
    require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    messages = get_session_messages(session_id)
    scores = get_session_scores(session_id)
    corrections = get_session_corrections(session_id)

    # Index scores and corrections by message_id
    scores_by_msg: dict[int, dict] = {}
    for s in scores:
        scores_by_msg[s["message_id"]] = dict(s)

    corrections_by_msg: dict[int, dict] = {}
    for c in corrections:
        corrections_by_msg[c["message_id"]] = dict(c)

    # Get translations
    translations = _translate_messages(messages)

    # Build detail messages
    detail_msgs: list[DetailMessage] = []
    for m in messages:
        msg_id = m["id"]

        # Pronunciation
        pron = None
        if msg_id in scores_by_msg:
            s = scores_by_msg[msg_id]
            words_data = []
            err_details = s.get("error_details")
            if err_details:
                try:
                    parsed = (_json.loads(err_details) if isinstance(err_details, str) else err_details)
                    words_data = parsed.get("words", []) if isinstance(parsed, dict) else []
                except Exception:
                    pass
            pron = DetailPronunciation(
                overall_score=round(s.get("overall_score", 0), 1),
                accuracy_score=round(s.get("accuracy_score", 0), 1),
                fluency_score=round(s.get("fluency_score", 0), 1),
                completeness_score=round(s.get("completeness_score", 0), 1),
                words=[WordScoreResponse(
                    word=w.get("word", ""),
                    accuracy_score=round(w.get("accuracy_score", 0), 1),
                    error_type=w.get("error_type", "None"),
                ) for w in words_data],
            )

        # Grammar
        gram = None
        if msg_id in corrections_by_msg:
            c = corrections_by_msg[msg_id]
            gram = DetailGrammar(
                original_text=c.get("original_text", ""),
                corrected_text=c.get("corrected_text", ""),
                error_type=c.get("error_type", ""),
                explanation=c.get("explanation", ""),
                explanation_cn="",
                better_expression="",
            )

        detail_msgs.append(DetailMessage(
            id=msg_id,
            role=m["role"],
            content=m["content"],
            translation_cn=translations.get(msg_id, ""),
            pronunciation=pron,
            grammar=gram,
        ))

    return SessionDetailResponse(
        session_id=session["id"],
        scene_name=session["scene_name"],
        scene_key=session["scene_key"],
        difficulty=session["difficulty"],
        model=session["model"],
        status=session["status"],
        total_rounds=session["total_rounds"],
        avg_pronunciation_score=round(session.get("avg_pronunciation_score", 0), 1),
        created_at=str(session.get("created_at", "")),
        ended_at=str(session.get("ended_at", "")),
        messages=detail_msgs,
        evaluation=_build_evaluation(session_id),
    )


def _build_evaluation(session_id: int) -> Optional[EvaluationResponse]:
    """Build evaluation response from DB record."""
    row = get_session_evaluation(session_id)
    if not row:
        return None
    extra = None
    raw = row.get("evaluation_json")
    if raw:
        try:
            extra = _json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            pass
    return EvaluationResponse(
        overall_score=round(row.get("overall_score", 0), 1),
        grammar_score=round(row.get("grammar_score", 0), 1),
        vocabulary_score=round(row.get("vocabulary_score", 0), 1),
        fluency_score=round(row.get("fluency_score", 0), 1),
        expression_score=round(row.get("expression_score", 0), 1),
        naturalness_score=round(row.get("naturalness_score", 0), 1),
        emotion_score=round(row.get("emotion_score", 0), 1),
        summary=extra.get("summary", "") if extra else "",
        strengths=extra.get("strengths", []) if extra else [],
        weaknesses=extra.get("weaknesses", []) if extra else [],
        suggestions=extra.get("suggestions", []) if extra else [],
    )
