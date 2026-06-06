"""
Grammar API: analyse English text for grammar errors via LLM.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Request, HTTPException
from backend.models.schemas import GrammarRequest, GrammarResponse
from modules.grammar import correct_grammar

router = APIRouter(prefix="/api/grammar", tags=["grammar"])


@router.post("/correct", response_model=GrammarResponse)
async def grammar_correct(req: GrammarRequest, request: Request):
    """Analyse a sentence and return grammar corrections."""
    try:
        result = correct_grammar(text=req.text, model_key=req.model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM service error: {str(exc)}. Please try again or switch model.",
        )

    return GrammarResponse(
        has_errors=result["has_errors"],
        original=result["original"],
        corrected=result["corrected"],
        errors=result["errors"],
    )
