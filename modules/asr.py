"""
iFlytek (科大讯飞) ASR — Automatic Speech Recognition Integration.

Uses iFlytek's IAT (语音听写) WebSocket streaming API for real-time
speech-to-text transcription. Supports audio in WAV/PCM format.

Reference: https://www.xfyun.cn/doc/asr/voicedictation/API.html
"""

import asyncio
import base64
import hashlib
import hmac
import io
import json
import logging
import wave
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode, quote

import websockets

from config.settings import XF_APPID, XF_API_KEY, XF_API_SECRET

logger = logging.getLogger(__name__)

# ============================================================
# Constants
# ============================================================

XF_IAT_HOST = "iat-api.xfyun.cn"
XF_IAT_PATH = "/v2/iat"
XF_IAT_URL = f"wss://{XF_IAT_HOST}{XF_IAT_PATH}"

# iFlytek IAT frame status codes
STATUS_FIRST_FRAME = 0
STATUS_CONTINUE_FRAME = 1
STATUS_LAST_FRAME = 2

# Audio format: raw PCM, 16kHz, 16bit, mono
AUDIO_SAMPLE_RATE = 16000
AUDIO_BITS = 16
AUDIO_CHANNELS = 1
FRAME_SIZE = 1280  # bytes per frame (40ms at 16kHz 16bit mono = 640 bytes, use 1280)


# ============================================================
# Authentication — HMAC-SHA256 Signature
# ============================================================

# English weekday/month names for RFC 1123 date format
# (must be hardcoded — strftime produces Chinese on Chinese Windows)
_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _rfc1123_date(dt: datetime) -> str:
    """Build RFC 1123 UTC date string with English names, regardless of system locale."""
    return (
        f"{_WEEKDAYS[dt.weekday()]}, {dt.day:02d} {_MONTHS[dt.month - 1]} "
        f"{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} GMT"
    )


def _build_auth_url() -> str:
    """
    Build the authenticated WebSocket URL for iFlytek IAT.

    Uses HMAC-SHA256 to sign the request, following the
    iFlytek API authentication specification.
    """
    if not XF_API_KEY or not XF_API_SECRET:
        raise RuntimeError(
            "iFlytek ASR not configured. Set XF_API_KEY and XF_API_SECRET in .env"
        )

    # RFC 1123 UTC date (always English)
    date = _rfc1123_date(datetime.utcnow())

    # Build signature string
    signature_origin = (
        f"host: {XF_IAT_HOST}\n"
        f"date: {date}\n"
        f"GET {XF_IAT_PATH} HTTP/1.1"
    )

    # HMAC-SHA256 signature
    signature_sha = hmac.new(
        XF_API_SECRET.encode("utf-8"),
        signature_origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    signature = base64.b64encode(signature_sha).decode()

    # Build authorization header
    authorization_origin = (
        f'api_key="{XF_API_KEY}", '
        f'algorithm="hmac-sha256", '
        f'headers="host date request-line", '
        f'signature="{signature}"'
    )
    authorization = base64.b64encode(
        authorization_origin.encode("utf-8")
    ).decode()

    # Build query params (use quote for %20 encoding, not quote_plus's +)
    params = {
        "host": XF_IAT_HOST,
        "date": date,
        "authorization": authorization,
    }
    url = f"{XF_IAT_URL}?{urlencode(params, quote_via=quote)}"
    logger.debug("[asr] Auth URL: %s...", url[:150])
    return url


# ============================================================
# Audio Conversion
# ============================================================


def _convert_to_pcm(audio_bytes: bytes) -> bytes:
    """
    Convert audio to 16kHz 16bit mono PCM WAV format.

    Tries multiple backends: pydub (requires ffmpeg),
    then falls back to assuming the input is already PCM/WAV.
    """
    # Check if already a valid WAV file
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        # Read existing WAV and check if it needs resampling
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                frame_rate = wf.getframerate()
                raw_pcm = wf.readframes(wf.getnframes())

            # If already 16k/16bit/mono, return raw PCM
            if channels == 1 and sample_width == 2 and frame_rate == 16000:
                return raw_pcm
        except Exception:
            pass

    # Try pydub for conversion
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        return audio.raw_data
    except ImportError:
        logger.warning(
            "[asr] pydub not installed, cannot convert audio format. "
            "Install with: pip install pydub"
        )
    except Exception as exc:
        logger.warning("[asr] pydub conversion failed: %s", exc)

    # Last resort: try to extract PCM data from WAV (even if wrong format)
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            return wf.readframes(wf.getnframes())
    except Exception:
        pass

    raise ValueError(
        "Cannot convert audio to required PCM format. "
        "Install pydub and ffmpeg for audio conversion support."
    )


# ============================================================
# iFlytek IAT WebSocket Client
# ============================================================


async def transcribe_audio(
    audio_base64: str,
    language: str = "en_us",
    accent: str = "",
) -> str:
    """
    Transcribe base64-encoded audio using iFlytek IAT WebSocket API.

    Args:
        audio_base64: Base64-encoded audio (WAV/PCM 16k/16bit/mono recommended,
                      other formats converted via pydub if available)
        language: Language code — "en_us" (English), "zh_cn" (Chinese),
                  "ja_jp" (Japanese), "ko_kr" (Korean)
        accent: Accent/dialect — "mandarin", "cantonese" (only for zh_cn;
                ignored/empty for other languages)

    Returns:
        Transcribed text string (empty if no speech detected)

    Raises:
        ValueError: Invalid audio data
        RuntimeError: API key not configured
        ConnectionError: WebSocket connection failed
        Exception: API call errors
    """
    if not audio_base64:
        raise ValueError("Audio data is required")

    # Auto-clear accent for non-Chinese languages
    # (accent only applies to Chinese dialects per iFlytek docs)
    if language != "zh_cn":
        accent = ""

    # Decode and validate audio
    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception:
        raise ValueError("Invalid base64 audio data")

    if len(audio_bytes) < 100:
        raise ValueError("Audio data too short (minimum ~100 bytes)")

    # Convert audio to PCM format
    try:
        pcm_data = _convert_to_pcm(audio_bytes)
    except Exception as exc:
        raise ValueError(f"Audio conversion failed: {exc}")

    if len(pcm_data) < 100:
        raise ValueError("Audio too short after conversion")

    logger.info(
        "[asr] Transcribing %d bytes of audio (lang=%s, accent=%s)",
        len(pcm_data), language, accent,
    )

    # Build connection URL
    url = _build_auth_url()

    # Transcribe via WebSocket
    result_text = ""
    try:
        async with websockets.connect(
            url,
            ping_interval=5,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            # Send audio frames
            total_frames = (len(pcm_data) + FRAME_SIZE - 1) // FRAME_SIZE

            for i in range(total_frames):
                start = i * FRAME_SIZE
                end = min(start + FRAME_SIZE, len(pcm_data))
                chunk = pcm_data[start:end]

                # Determine frame status
                if i == 0:
                    status = STATUS_FIRST_FRAME
                elif i == total_frames - 1:
                    status = STATUS_LAST_FRAME
                else:
                    status = STATUS_CONTINUE_FRAME

                # Build frame payload
                frame = {
                    "common": {"app_id": XF_APPID},
                    "business": {
                        "language": language,
                        "accent": accent,
                        "domain": "iat",
                        "dwa": "wpgs",  # dynamic word-level augmentation
                        "ptt": 0,        # punctuation: 0 = no, 1 = yes
                        "vad_eos": 3000,  # VAD end-of-speech timeout (ms)
                    },
                    "data": {
                        "status": status,
                        "format": "audio/L16;rate=16000",
                        "encoding": "raw",
                        "audio": base64.b64encode(chunk).decode(),
                    },
                }

                await ws.send(json.dumps(frame))

                # Read responses after last frame
                if status == STATUS_LAST_FRAME:
                    while True:
                        try:
                            resp_raw = await asyncio.wait_for(
                                ws.recv(), timeout=3.0
                            )
                            resp = json.loads(resp_raw)

                            # Check for errors
                            if resp.get("code") and resp["code"] != 0:
                                err_msg = resp.get("message", "Unknown error")
                                logger.error(
                                    "[asr] iFlytek API error code=%s: %s",
                                    resp["code"], err_msg,
                                )
                                raise RuntimeError(
                                    f"iFlytek API error: {err_msg} (code={resp['code']})"
                                )

                            # Extract transcription text
                            data = resp.get("data", {})
                            result_data = data.get("result", {})
                            if result_data:
                                # dwa=wpgs returns FULL accumulated text each time,
                                # NOT incremental deltas — so we REPLACE, not append.
                                segment_text = ""
                                ws_list = result_data.get("ws", [])
                                for word_seg in ws_list:
                                    cw_list = word_seg.get("cw", [])
                                    for char_word in cw_list:
                                        w = char_word.get("w", "")
                                        segment_text += w
                            
                                # Keep only the latest full-text result
                                if segment_text:
                                    result_text = segment_text
                            
                            # Check if this is the final result
                            status_code = data.get("status", 0)
                            if status_code == 2:  # 2 = LAST_END
                                break

                        except asyncio.TimeoutError:
                            break
                        except websockets.exceptions.ConnectionClosed:
                            break

    except websockets.exceptions.InvalidURI as exc:
        raise ConnectionError(f"Invalid WebSocket URI: {exc}")
    except websockets.exceptions.InvalidHandshake as exc:
        raise ConnectionError(f"WebSocket handshake failed (check API credentials): {exc}")
    except OSError as exc:
        raise ConnectionError(f"WebSocket connection failed: {exc}")

    # Clean up result
    result_text = result_text.strip()
    if result_text:
        logger.info("[asr] Transcription result: %s", result_text[:100])
    else:
        logger.warning("[asr] No speech detected in audio")

    return result_text


def transcribe_audio_sync(
    audio_base64: str,
    language: str = "en_us",
    accent: str = "mandarin",
) -> str:
    """
    Synchronous wrapper for transcribe_audio().
    Use in non-async contexts (e.g. FastAPI thread pool).
    """
    return asyncio.run(transcribe_audio(audio_base64, language, accent))


# ============================================================
# Utility
# ============================================================


def is_configured() -> bool:
    """Check if iFlytek ASR is properly configured."""
    return bool(XF_APPID and XF_API_KEY and XF_API_SECRET)
