"""
Chivox MCP-based Pronunciation Assessment Client.

Connects to Chivox's hosted MCP server (mcp-global.cloud.chivox.com) for
phoneme-level pronunciation scoring — real audio analysis, not text comparison.

Uses the MCP Streamable HTTP transport with Bearer token authentication.
Response includes: overall, accuracy, pron, fluency, integrity, and per-phoneme
details with dp_type verdicts (normal/mispron/omission/insertion).

Reference: https://api-portal.cloud.chivox.com/docs
"""

import asyncio
import base64
import logging
from dataclasses import dataclass, field
from typing import Optional

from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

from config.settings import CHIVOX_API_KEY, CHIVOX_MCP_URL

logger = logging.getLogger(__name__)

# ============================================================
# Output Dataclass
# ============================================================


@dataclass
class ChivoxPhoneDetail:
    """A single phoneme-level score from Chivox."""
    phoneme: str           # e.g. "h", "ɛ", "l", "oʊ"
    score: float           # 0-100
    dp_type: str           # "normal" | "mispron" | "omission" | "insertion"
    expected: str = ""     # expected phoneme (for mispron cases)
    actual: str = ""       # actual detected phoneme


@dataclass
class ChivoxWordDetail:
    """Per-word detail from Chivox."""
    word: str
    score: float
    phones: list[ChivoxPhoneDetail] = field(default_factory=list)


@dataclass
class ChivoxFluency:
    """Fluency sub-scores."""
    overall: float = 0
    speed: float = 0
    pause: int = 0


@dataclass
class ChivoxResult:
    """Full Chivox pronunciation assessment result."""
    overall: float = 0
    accuracy: float = 0
    pron: float = 0
    integrity: float = 0
    fluency: ChivoxFluency = field(default_factory=ChivoxFluency)
    details: list[ChivoxWordDetail] = field(default_factory=list)
    error: str = ""

    @classmethod
    def from_chivox_response(cls, data: dict) -> "ChivoxResult":
        """Parse raw Chivox MCP tool response into ChivoxResult."""
        if not data:
            return cls(error="Empty response from Chivox")

        fluency_data = data.get("fluency", {}) or {}
        fluency = ChivoxFluency(
            overall=fluency_data.get("overall", 0),
            speed=fluency_data.get("speed", 0),
            pause=fluency_data.get("pause", 0),
        )

        details = []
        for d in data.get("details", []):
            phones = []
            for p in d.get("phone", []):
                phone_err = p.get("phoneme_error", {}) or {}
                phones.append(ChivoxPhoneDetail(
                    phoneme=p.get("phoneme", ""),
                    score=p.get("score", 0),
                    dp_type=p.get("dp_type", "normal"),
                    expected=phone_err.get("expected", ""),
                    actual=phone_err.get("actual", ""),
                ))
            details.append(ChivoxWordDetail(
                word=d.get("char", ""),
                score=d.get("score", 0),
                phones=phones,
            ))

        return cls(
            overall=data.get("overall", 0),
            accuracy=data.get("accuracy", 0),
            pron=data.get("pron", 0),
            integrity=data.get("integrity", 0),
            fluency=fluency,
            details=details,
        )


# ============================================================
# MCP Client
# ============================================================


async def _call_chivox_mcp(
    tool_name: str,
    arguments: dict,
) -> dict:
    """
    Connect to Chivox MCP server and call a tool.

    Args:
        tool_name: MCP tool name (e.g. "en_sentence_eval")
        arguments: Tool arguments dict

    Returns:
        Tool result content as dict

    Raises:
        RuntimeError: If Chivox API key is not configured
        Exception: On MCP connection or tool call errors
    """
    if not CHIVOX_API_KEY:
        raise RuntimeError(
            "Chivox API key not configured. Set CHIVOX_API_KEY in .env"
        )

    async with streamablehttp_client(
        CHIVOX_MCP_URL,
        headers={"Authorization": f"Bearer {CHIVOX_API_KEY}"},
    ) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)

            # Extract text content from MCP result
            for content in result.content:
                if hasattr(content, "text"):
                    import json
                    return json.loads(content.text)

            return {}


def _validate_audio_base64(audio_base64: str) -> bytes:
    """Validate and decode base64 audio data."""
    try:
        raw = base64.b64decode(audio_base64)
        if len(raw) == 0:
            raise ValueError("Empty audio data")
        # Check for common audio headers
        if raw[:4] == b"RIFF" or raw[:3] == b"ID3" or raw[:2] == b"\xff\xfb":
            return raw
        # Could be raw PCM or other format — pass through
        return raw
    except Exception as e:
        raise ValueError(f"Invalid audio base64: {e}")


async def assess_with_chivox(
    audio_base64: str,
    reference_text: str,
    accent: str = "en-US",
) -> ChivoxResult:
    """
    Assess pronunciation using Chivox's phoneme-level engine.

    Args:
        audio_base64: Base64-encoded audio (mp3/wav/ogg/m4a/aac/pcm)
        reference_text: The expected text the student should read
        accent: Accent rubric (en-US, en-GB, en-AU)

    Returns:
        ChivoxResult with phoneme-level scoring

    Raises:
        ValueError: If audio data is invalid
        RuntimeError: If API key is not configured
        Exception: On API call failure
    """
    # Validate inputs
    if not audio_base64 or not audio_base64.strip():
        return ChivoxResult(error="Audio data is empty")

    if not reference_text or not reference_text.strip():
        return ChivoxResult(error="Reference text is required")

    _validate_audio_base64(audio_base64)

    try:
        result_data = await _call_chivox_mcp(
            "en_sentence_eval",
            {
                "audio_base64": audio_base64,
                "ref_text": reference_text.strip(),
                "accent": accent,
            },
        )
        return ChivoxResult.from_chivox_response(result_data)

    except Exception as exc:
        logger.error("[chivox] Assessment failed: %s", exc)
        return ChivoxResult(error=f"Chivox API error: {exc}")


def assess_with_chivox_sync(
    audio_base64: str,
    reference_text: str,
    accent: str = "en-US",
) -> ChivoxResult:
    """
    Synchronous wrapper for assess_with_chivox().
    Use in non-async contexts (e.g. FastAPI thread pool).
    """
    return asyncio.run(assess_with_chivox(audio_base64, reference_text, accent))


# ============================================================
# Chivox → PronunciationResult Converter
# ============================================================


def chivox_to_pronunciation_result(chivox_result: ChivoxResult) -> "PronunciationResult":
    """
    Convert ChivoxResult to the project's standard PronunciationResult format.

    This ensures compatibility with the existing evaluation_graph,
    pronunciation API, and frontend components.
    """
    from modules.pronunciation import PronunciationResult, WordScore

    if chivox_result.error:
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error=chivox_result.error,
        )

    # Map Chivox dimensions to our 6-dimension model
    accuracy = chivox_result.accuracy
    fluency = chivox_result.fluency.overall
    completeness = chivox_result.integrity  # integrity ≈ completeness
    overall = chivox_result.overall

    # Estimate missing dimensions from available data
    stress = min(accuracy * 0.9, 95)    # approximated from accuracy
    intonation = min(fluency * 0.85, 95)  # approximated from fluency
    rhythm = min((accuracy + fluency) / 2 * 0.9, 95)

    # Build word-level scores
    words: list[WordScore] = []
    for wd in chivox_result.details:
        error_type = "None"
        correction_cn = ""
        expected_pron = ""

        # Check if any phoneme has a mispronunciation
        for phone in wd.phones:
            if phone.dp_type == "mispron":
                error_type = "Mispronunciation"
                correction_cn = f"音素 /{phone.expected}/ 发音有误，实际发音接近 /{phone.actual}/"
                expected_pron = phone.expected
                break
            elif phone.dp_type == "omission":
                error_type = "Omission"
                correction_cn = f"漏读了音素 /{phone.phoneme}/"
                break
            elif phone.dp_type == "insertion":
                error_type = "Insertion"
                correction_cn = f"多读了音素 /{phone.phoneme}/"
                break

        words.append(WordScore(
            word=wd.word,
            accuracy_score=wd.score,
            error_type=error_type,
            expected_pronunciation=expected_pron,
            correction_cn=correction_cn,
        ))

    # Build phoneme highlights
    phoneme_highlights = []
    for wd in chivox_result.details:
        for phone in wd.phones:
            if phone.dp_type == "mispron":
                phoneme_highlights.append(
                    f"/{phone.expected}/: pronounced as /{phone.actual}/ "
                    f"in '{wd.word}' (score: {phone.score})"
                )
            elif phone.dp_type == "omission":
                phoneme_highlights.append(
                    f"/{phone.phoneme}/: omitted in '{wd.word}'"
                )

    # Build bilingual summaries
    score_grade = (
        "Excellent" if overall >= 90 else
        "Very Good" if overall >= 80 else
        "Good" if overall >= 70 else
        "Fair" if overall >= 60 else "Needs Improvement"
    )
    summary_en = (
        f"Overall pronunciation: {overall:.0f}/100 ({score_grade}). "
        f"Accuracy: {accuracy:.0f}, Fluency: {fluency:.0f}, "
        f"Completeness: {completeness:.0f}. "
    )
    if phoneme_highlights:
        summary_en += f"Key issues: {'; '.join(phoneme_highlights[:3])}"
    else:
        summary_en += "All phonemes pronounced correctly."

    score_grade_cn = (
        "优秀" if overall >= 90 else "很好" if overall >= 80 else
        "良好" if overall >= 70 else "一般" if overall >= 60 else "需要提高"
    )

    # Count errors for Chinese summary
    error_count = sum(
        1 for wd in chivox_result.details
        for phone in wd.phones
        if phone.dp_type != "normal"
    )
    summary_cn = (
        f"Chivox音素级评测 — 总分: {overall:.0f}/100 ({score_grade_cn})。"
        f"准确度: {accuracy:.0f}, 流利度: {fluency:.0f}, "
        f"完整度: {completeness:.0f}。"
    )
    if error_count > 0:
        summary_cn += f"检测到 {error_count} 处音素问题。"
    else:
        summary_cn += "所有音素发音正确。"

    # Build suggestions
    suggestions = []
    if error_count > 0:
        suggestions.append(
            f"Review the {error_count} phoneme issues highlighted above. "
            f"Practice each problem sound slowly and clearly."
        )
        # Add specific phoneme suggestions
        problem_phonemes = set()
        for wd in chivox_result.details:
            for phone in wd.phones:
                if phone.dp_type == "mispron":
                    problem_phonemes.add(phone.expected)
        if problem_phonemes:
            suggestions.append(
                f"Focus on these sounds: {', '.join(sorted(problem_phonemes)[:5])}. "
                f"Use a mirror to check mouth position."
            )
    if fluency < 70:
        suggestions.append(
            "Work on speaking more smoothly. Try shadowing native speakers "
            "and practice connected speech."
        )
    suggestions.append(
        "Record yourself again after practicing to track improvement over time."
    )

    return PronunciationResult(
        accuracy_score=round(accuracy, 1),
        fluency_score=round(fluency, 1),
        completeness_score=round(completeness, 1),
        overall_score=round(overall, 1),
        stress_score=round(stress, 1),
        intonation_score=round(intonation, 1),
        rhythm_score=round(rhythm, 1),
        words=words,
        phoneme_highlights=phoneme_highlights,
        summary_en=summary_en,
        summary_cn=summary_cn,
        suggestions=suggestions,
    )
