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
    SessionDetailResponse,
    DetailMessage,
    DetailPronunciation,
    DetailGrammar,
    WordScoreResponse,
    EvaluationResponse,
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
    add_message,
    delete_session,
    save_session_evaluation,
)
from config.settings import SCENES
from modules.llm import generate_reply, generate_opening
from modules.evaluation import evaluate_session

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

    # ── Run LLM multi-dimension evaluation ──
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
        # Update session avg_pronunciation_score with evaluation overall
        import sqlite3
        conn = __import__("utils.db", fromlist=["get_connection"]).get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sessions SET avg_pronunciation_score = ? WHERE id = ?",
            (eval_result.overall_score, session_id),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        logger = __import__("logging").getLogger(__name__)
        logger.warning("Session evaluation skipped: %s", exc)

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


@router.post("/{session_id}/messages", response_model=list[MessageResponse])
async def send_message(session_id: int, req: SendMessageRequest, request: Request):
    """Send a user message and get an AI reply via the LLM conversation engine."""
    user = require_auth(request)

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active.")

    # 1. Persist user message
    add_message(session_id, "user", req.content)

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

    # 5. Return full message list
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
