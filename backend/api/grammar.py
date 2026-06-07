"""
Grammar API: analyse English text for grammar errors via LLM.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from pydantic import BaseModel
from backend.models.schemas import GrammarRequest, GrammarResponse, GrammarError, ExpressionImprovement
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
        errors=[
            GrammarError(
                type=e.get("type", ""),
                original_text=e.get("original_text", ""),
                corrected_text=e.get("corrected_text", ""),
                explanation=e.get("explanation", ""),
                explanation_cn=e.get("explanation_cn", ""),
                better_expression=e.get("better_expression", ""),
            )
            for e in result["errors"]
        ],
        expression_improvements=[
            ExpressionImprovement(
                original_phrase=ei.get("original_phrase", ""),
                improved_phrase=ei.get("improved_phrase", ""),
                explanation=ei.get("explanation", ""),
                explanation_cn=ei.get("explanation_cn", ""),
            )
            for ei in result.get("expression_improvements", [])
        ],
    )


class ExtractTextResponse(BaseModel):
    text: str
    source: str  # "image" | "document"


@router.post("/extract-text", response_model=ExtractTextResponse)
async def extract_text_from_file(file: UploadFile = File(...)):
    """Extract English text from uploaded images or text documents."""
    import base64

    content = await file.read()
    filename = (file.filename or "").lower()
    content_type = file.content_type or ""

    # --- Text-based files: parse directly ---
    text_extensions = {".txt", ".md", ".csv"}
    if any(filename.endswith(ext) for ext in text_extensions) or "text/plain" in content_type:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace")
        return ExtractTextResponse(text=text.strip(), source="document")

    # --- Image files: use LLM vision to extract text ---
    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
    mime_map = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
    }
    is_image = False
    mime = "image/png"
    for ext, m in mime_map.items():
        if filename.endswith(ext) or ext in content_type:
            is_image = True
            mime = m
            break

    if not is_image:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: images (.png/.jpg/.webp) and text (.txt/.md/.csv).",
        )

    # Call LLM vision to extract text
    b64 = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    extracted = await _vision_extract(data_url)
    return ExtractTextResponse(text=extracted.strip(), source="image")


async def _vision_extract(data_url: str) -> str:
    """Use LLM vision to extract English text from an image."""
    import asyncio

    prompt = """Please extract ALL English text visible in this image.
Return ONLY the extracted English text, preserving line breaks and paragraph structure.
Do not add any explanations, translations, or extra commentary.
If no English text is found, respond with 'No English text found.'"""

    async def _try_deepseek():
        from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
        if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.startswith("sk-your-"):
            raise RuntimeError("No DeepSeek key")
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        resp = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=500, temperature=0.1,
        )
        return resp.choices[0].message.content or ""

    async def _try_openai():
        from config.settings import OPENAI_API_KEY
        if not OPENAI_API_KEY or OPENAI_API_KEY.startswith("sk-your-"):
            raise RuntimeError("No OpenAI key")
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=500, temperature=0.1,
        )
        return resp.choices[0].message.content or ""

    try:
        return await _try_deepseek()
    except Exception:
        pass

    try:
        return await _try_openai()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OCR extraction failed: {str(exc)}")
