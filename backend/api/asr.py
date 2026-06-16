"""ASR (Automatic Speech Recognition) API endpoint — iFlytek (科大讯飞)."""

import base64
import logging
from fastapi import APIRouter, HTTPException
from backend.models.schemas import ASRRequest, ASRResponse
from modules.asr import transcribe_audio, is_configured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/asr", tags=["asr"])


@router.post("/transcribe", response_model=ASRResponse)
async def transcribe(req: ASRRequest):
    """
    Transcribe speech audio to text using iFlytek (科大讯飞) ASR.

    Accepts base64-encoded audio (WAV/PCM 16kHz 16bit mono recommended).
    Other formats are auto-converted via pydub if installed.
    """
    # Check if configured
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="iFlytek ASR not configured. Set XF_APPID, XF_API_KEY, and XF_API_SECRET in .env",
        )

    # Validate base64
    try:
        base64.b64decode(req.audio_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    # Transcribe (await async directly — no thread pool needed)
    try:
        text = await transcribe_audio(
            audio_base64=req.audio_base64,
            language=req.language,
            accent=req.accent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=f"iFlytek connection failed: {exc}")
    except Exception as exc:
        logger.exception("[asr] Unexpected error during transcription")
        raise HTTPException(status_code=502, detail=f"ASR failed: {exc}")

    return ASRResponse(
        text=text,
        language=req.language,
        provider="iflytek",
    )


@router.get("/status")
async def status():
    """Check if iFlytek ASR is configured and available."""
    return {
        "configured": is_configured(),
        "provider": "iflytek",
    }
