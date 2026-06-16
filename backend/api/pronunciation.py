"""Pronunciation Assessment API — text-based (LLM) + audio-based (Chivox MCP)."""

import asyncio
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.models.schemas import PronunciationResponse, WordScoreResponse
from modules.pronunciation import assess, assess_audio

router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


class PronunciationAssessRequest(BaseModel):
    recognized_text: str = Field(..., min_length=1, description="Text recognized by browser Speech Recognition")
    reference_text: str = Field(..., min_length=1, description="Expected reference text")


class PronunciationAudioRequest(BaseModel):
    """Request for audio-based pronunciation assessment (Chivox MCP)."""
    audio_base64: str = Field(..., min_length=1, description="Base64-encoded audio (mp3/wav/ogg/m4a)")
    reference_text: str = Field(..., min_length=1, description="Expected reference text")
    recognized_text: str = Field(default="", description="Optional: recognized text for LLM fallback")
    accent: str = Field(default="en-US", description="Accent rubric: en-US, en-GB, en-AU")


def _build_response(result) -> PronunciationResponse:
    """Build PronunciationResponse from PronunciationResult."""
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
        error=result.error or "",
    )


@router.post("/assess", response_model=PronunciationResponse)
async def assess_pronunciation(req: PronunciationAssessRequest):
    """Compare recognized speech text with reference text to get pronunciation scores (LLM-based)."""
    result = await asyncio.to_thread(assess, req.recognized_text, req.reference_text)
    return _build_response(result)


@router.post("/assess-audio", response_model=PronunciationResponse)
async def assess_pronunciation_audio(req: PronunciationAudioRequest):
    """
    Assess pronunciation from real audio using Chivox MCP (primary) with LLM fallback.

    The audio is sent as base64-encoded bytes (mp3/wav/ogg/m4a).
    Chivox provides phoneme-level scoring; if unavailable, falls back to LLM text comparison.
    """
    # Validate base64
    try:
        base64.b64decode(req.audio_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    result = await asyncio.to_thread(
        assess_audio,
        audio_base64=req.audio_base64,
        reference_text=req.reference_text,
        recognized_text=req.recognized_text,
        accent=req.accent,
    )
    return _build_response(result)
