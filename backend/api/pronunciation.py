"""Pronunciation Assessment API endpoint."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from backend.models.schemas import PronunciationResponse, WordScoreResponse
from modules.pronunciation import assess

router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


@router.post("/assess", response_model=PronunciationResponse)
async def assess_pronunciation(
    audio: UploadFile = File(..., description="WAV audio (16kHz, 16-bit, mono)"),
    reference_text: str = Form(..., description="Expected transcription text"),
):
    """Upload audio with reference text to get pronunciation scores."""
    if not audio.filename or not audio.filename.endswith((".wav", ".mp3", ".webm")):
        raise HTTPException(status_code=400, detail="Audio must be WAV, MP3, or WebM format")

    try:
        audio_bytes = await audio.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read audio file")

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio too large (max 10MB)")

    result = assess(audio_bytes, reference_text)

    if result.error:
        raise HTTPException(
            status_code=502,
            detail=f"Assessment failed: {result.error}",
        )

    return PronunciationResponse(
        accuracy_score=round(result.accuracy_score, 1),
        fluency_score=round(result.fluency_score, 1),
        completeness_score=round(result.completeness_score, 1),
        overall_score=round(result.overall_score, 1),
        words=[
            WordScoreResponse(
                word=w.word,
                accuracy_score=round(w.accuracy_score, 1),
                error_type=w.error_type,
            )
            for w in result.words
        ],
    )


@router.post("/assess-safe", response_model=PronunciationResponse)
async def assess_pronunciation_safe(
    audio: UploadFile = File(..., description="WAV audio (16kHz, 16-bit, mono)"),
    reference_text: str = Form(..., description="Expected transcription text"),
):
    """Same as /assess but always returns 200 (useful when Azure key is missing)."""
    try:
        audio_bytes = await audio.read()
    except Exception:
        return PronunciationResponse(error="Failed to read audio file")

    if len(audio_bytes) == 0:
        return PronunciationResponse(error="Empty audio file")

    result = assess(audio_bytes, reference_text)

    return PronunciationResponse(
        accuracy_score=round(result.accuracy_score, 1) if not result.error else 0,
        fluency_score=round(result.fluency_score, 1) if not result.error else 0,
        completeness_score=round(result.completeness_score, 1) if not result.error else 0,
        overall_score=round(result.overall_score, 1) if not result.error else 0,
        words=[
            WordScoreResponse(
                word=w.word,
                accuracy_score=round(w.accuracy_score, 1),
                error_type=w.error_type,
            )
            for w in result.words
        ],
        error=result.error or "",
    )
