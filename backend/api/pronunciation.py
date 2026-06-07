"""Pronunciation Assessment API endpoint — text-based (Web Speech API + LLM)."""

import asyncio
from fastapi import APIRouter
from pydantic import BaseModel, Field
from backend.models.schemas import PronunciationResponse, WordScoreResponse
from modules.pronunciation import assess

router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


class PronunciationAssessRequest(BaseModel):
    recognized_text: str = Field(..., min_length=1, description="Text recognized by browser Speech Recognition")
    reference_text: str = Field(..., min_length=1, description="Expected reference text")


@router.post("/assess", response_model=PronunciationResponse)
async def assess_pronunciation(req: PronunciationAssessRequest):
    """Compare recognized speech text with reference text to get pronunciation scores."""
    result = await asyncio.to_thread(assess, req.recognized_text, req.reference_text)

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
