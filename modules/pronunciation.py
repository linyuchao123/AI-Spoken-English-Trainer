"""
Pronunciation Assessment engine using Azure Speech SDK.
Provides accuracy, fluency, completeness scores and word-level feedback.
"""

import tempfile
import os
import logging
from dataclasses import dataclass, field

from config.settings import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

logger = logging.getLogger(__name__)


@dataclass
class WordScore:
    word: str
    accuracy_score: float
    error_type: str  # "None", "Omission", "Insertion", "Mispronunciation"


@dataclass
class PronunciationResult:
    accuracy_score: float       # 0-100
    fluency_score: float        # 0-100
    completeness_score: float   # 0-100
    overall_score: float        # 0-100
    words: list[WordScore] = field(default_factory=list)
    error: str = ""


def assess(audio_bytes: bytes, reference_text: str) -> PronunciationResult:
    """
    Assess pronunciation of audio against reference text.

    Args:
        audio_bytes: Raw WAV audio bytes (16kHz, 16-bit, mono).
        reference_text: Expected transcription.

    Returns:
        PronunciationResult with scores and word-level details.
    """
    if not AZURE_SPEECH_KEY:
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="AZURE_SPEECH_KEY not configured",
        )

    # Write audio to temp file (Azure SDK needs a file path)
    tmp_path = ""
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(audio_bytes)

        result = _assess_file(tmp_path, reference_text)
        return result
    except Exception as exc:
        logger.error("Pronunciation assessment failed: %s", exc)
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error=str(exc),
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _assess_file(audio_path: str, reference_text: str) -> PronunciationResult:
    import azure.cognitiveservices.speech as speechsdk

    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION,
    )

    # Pronunciation assessment config
    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Word,
    )
    pronunciation_config.enable_prosody_assessment()

    audio_config = speechsdk.audio.AudioConfig(filename=audio_path)
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config, audio_config=audio_config,
    )
    pronunciation_config.apply_to(recognizer)

    result = recognizer.recognize_once_async().get()

    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        pr = speechsdk.PronunciationAssessmentResult(result)

        # Word-level details
        words: list[WordScore] = []
        for w in pr.words:
            words.append(WordScore(
                word=w.word,
                accuracy_score=w.accuracy_score,
                error_type=w.error_type or "None",
            ))

        return PronunciationResult(
            accuracy_score=pr.accuracy_score,
            fluency_score=pr.fluency_score,
            completeness_score=pr.completeness_score,
            overall_score=(pr.accuracy_score + pr.fluency_score + pr.completeness_score) / 3,
            words=words,
        )

    elif result.reason == speechsdk.ResultReason.NoMatch:
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="No speech detected in audio",
        )
    elif result.reason == speechsdk.ResultReason.Canceled:
        c = result.cancellation_details
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error=f"Canceled: {c.reason} — {c.error_details}",
        )
    else:
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error=f"Unexpected result: {result.reason}",
        )
