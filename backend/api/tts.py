"""TTS (Text-to-Speech) API endpoint."""

import asyncio
from fastapi import APIRouter, HTTPException
from backend.models.schemas import TTSRequest, TTSResponse, TTSVoicesResponse
from modules.tts import tts_to_base64, get_available_voices

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.post("/speak", response_model=TTSResponse)
async def speak(req: TTSRequest):
    """Convert text to speech, return base64 MP3."""
    try:
        audio_b64 = await asyncio.to_thread(
            tts_to_base64,
            text=req.text,
            voice=req.voice,
            provider=req.provider,
            rate=req.rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS failed: {exc}")

    return TTSResponse(
        audio_base64=audio_b64,
        format="mp3",
        voice=req.voice if req.voice != "default" else "default",
        provider=req.provider,
    )


@router.get("/voices", response_model=TTSVoicesResponse)
async def list_voices():
    return TTSVoicesResponse(voices=get_available_voices())
