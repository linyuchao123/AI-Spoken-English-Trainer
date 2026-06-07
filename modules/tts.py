"""
Text-to-Speech (TTS) engine.
Priority: Edge TTS (free) → Azure Speech → OpenAI TTS
"""

import asyncio
import base64
import logging
from config.settings import (
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    OPENAI_TTS_MODEL,
    OPENAI_TTS_VOICE,
)

logger = logging.getLogger(__name__)

EDGE_VOICES = {
    "en-US-AriaNeural": "Aria (Female, US)",
    "en-US-JennyNeural": "Jenny (Female, US)",
    "en-US-GuyNeural": "Guy (Male, US)",
    "en-GB-SoniaNeural": "Sonia (Female, UK)",
    "en-GB-RyanNeural": "Ryan (Male, UK)",
}

AZURE_VOICES = {
    "en-US-AriaNeural": "Aria (Female, US)",
    "en-US-GuyNeural": "Guy (Male, US)",
    "en-US-JennyNeural": "Jenny (Female, US)",
    "en-GB-SoniaNeural": "Sonia (Female, UK)",
    "en-GB-RyanNeural": "Ryan (Male, UK)",
}

OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

DEFAULT_EDGE_VOICE = "en-US-JennyNeural"
DEFAULT_AZURE_VOICE = "en-US-JennyNeural"
DEFAULT_OPENAI_VOICE = OPENAI_TTS_VOICE or "alloy"


def text_to_speech(
    text: str,
    voice: str = "default",
    provider: str = "edge",
    rate: float = 1.0,
) -> bytes:
    """Convert text to speech. Priority chain: preferred provider → fallbacks."""
    if provider == "edge":
        chain = [_try_edge, _try_azure, _try_openai]
    elif provider == "azure":
        chain = [_try_azure, _try_edge, _try_openai]
    elif provider == "openai":
        chain = [_try_openai, _try_edge, _try_azure]
    else:
        chain = [_try_edge, _try_azure, _try_openai]

    for attempt in chain:
        try:
            return attempt(text, voice, rate)
        except Exception as exc:
            logger.debug("%s failed: %s", attempt.__name__, exc)

    raise RuntimeError("All TTS providers failed")


def _try_edge(text: str, voice: str, rate: float = 1.0) -> bytes:
    """Edge TTS (always available, no key needed)."""
    voice_name = voice if voice != "default" else DEFAULT_EDGE_VOICE
    if voice_name not in EDGE_VOICES and voice != "default":
        voice_name = DEFAULT_EDGE_VOICE
    return asyncio.run(_edge_tts_async(text, voice_name, rate))


async def _edge_tts_async(text: str, voice_name: str, rate: float = 1.0) -> bytes:
    import edge_tts
    # Convert float rate (0.5~2.0) to edge_tts format (e.g. "-50%", "+20%")
    rate_pct = int((rate - 1.0) * 100)
    rate_str = f"{rate_pct:+d}%"
    communicate = edge_tts.Communicate(text, voice_name, rate=rate_str)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def _try_azure(text: str, voice: str, rate: float = 1.0) -> bytes:
    """Azure Speech TTS (requires AZURE_SPEECH_KEY)."""
    if not AZURE_SPEECH_KEY:
        raise RuntimeError("AZURE_SPEECH_KEY not configured")

    import azure.cognitiveservices.speech as speechsdk

    voice_name = voice if voice != "default" else DEFAULT_AZURE_VOICE
    if voice_name not in AZURE_VOICES:
        voice_name = DEFAULT_AZURE_VOICE

    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION,
    )
    speech_config.speech_synthesis_voice_name = voice_name
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
    )
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return result.audio_data
    elif result.reason == speechsdk.ResultReason.Canceled:
        c = result.cancellation_details
        raise RuntimeError(f"Azure canceled: {c.reason} — {c.error_details}")
    else:
        raise RuntimeError(f"Azure unexpected: {result.reason}")


def _try_openai(text: str, voice: str, rate: float = 1.0) -> bytes:
    """OpenAI TTS (requires OPENAI_API_KEY)."""
    from openai import OpenAI
    from config.settings import OPENAI_API_KEY

    if not OPENAI_API_KEY or OPENAI_API_KEY.startswith("sk-your-"):
        raise RuntimeError("OPENAI_API_KEY not configured")

    voice_name = voice if voice != "default" else DEFAULT_OPENAI_VOICE
    if voice_name not in OPENAI_VOICES:
        voice_name = DEFAULT_OPENAI_VOICE

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.audio.speech.create(
        model=OPENAI_TTS_MODEL, voice=voice_name, input=text, response_format="mp3",
    )
    return response.content


def tts_to_base64(text: str, voice: str = "default", provider: str = "edge", rate: float = 1.0) -> str:
    audio_bytes = text_to_speech(text, voice=voice, provider=provider, rate=rate)
    return base64.b64encode(audio_bytes).decode("utf-8")


def get_available_voices() -> dict:
    voices: dict = {
        "edge": [{"key": k, "name": v} for k, v in EDGE_VOICES.items()],
    }
    if AZURE_SPEECH_KEY:
        voices["azure"] = [{"key": k, "name": v} for k, v in AZURE_VOICES.items()]
    voices["openai"] = [
        {"key": v, "name": v.capitalize(), "gender": "varied"}
        for v in OPENAI_VOICES
    ]
    return voices
