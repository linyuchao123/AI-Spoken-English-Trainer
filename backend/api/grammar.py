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

    # --- PDF files ---
    if filename.endswith(".pdf") or "pdf" in content_type:
        extracted = await _extract_pdf_text(content)
        return ExtractTextResponse(text=extracted.strip(), source="document")

    # --- DOC/DOCX files ---
    if filename.endswith((".doc", ".docx")) or "word" in content_type or "document" in content_type:
        extracted = await _extract_docx_text(content, filename)
        return ExtractTextResponse(text=extracted.strip(), source="document")

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
            detail=f"Unsupported file type. Supported: images (.png/.jpg/.webp), PDF, Word (.doc/.docx), and text (.txt/.md/.csv).",
        )

    # Call LLM vision to extract text
    b64 = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    extracted = await _vision_extract(data_url)
    return ExtractTextResponse(text=extracted.strip(), source="image")


async def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF file content."""
    import asyncio
    try:
        import io
        # Try PyPDF2 / pypdf first (lightweight)
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            texts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texts.append(t)
            return "\n".join(texts) if texts else "No text found in PDF."
        except ImportError:
            pass
        # Fallback: try PyPDF2
        try:
            from PyPDF2 import PdfReader as PdfReader2
            reader = PdfReader2(io.BytesIO(content))
            texts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texts.append(t)
            return "\n".join(texts) if texts else "No text found in PDF."
        except ImportError:
            pass
        raise RuntimeError("No PDF library available. Please install pypdf or PyPDF2.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")


async def _extract_docx_text(content: bytes, filename: str) -> str:
    """Extract text from DOCX file content."""
    try:
        import io
        # Try python-docx for .docx files
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            texts = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(texts) if texts else "No text found in document."
        except ImportError:
            pass
        # Fallback for .doc (old format): try antiword or textract
        if filename.endswith(".doc"):
            try:
                import subprocess, tempfile, os
                with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as f:
                    f.write(content)
                    tmp_path = f.name
                try:
                    result = subprocess.run(["antiword", tmp_path], capture_output=True, text=True, timeout=10)
                    if result.returncode == 0 and result.stdout.strip():
                        return result.stdout.strip()
                finally:
                    os.unlink(tmp_path)
            except Exception:
                pass
        raise RuntimeError("No DOCX library available. Please install python-docx.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {str(e)}")


async def _vision_extract(data_url: str) -> str:
    """Use LLM vision to extract English text from an image.
    
    Priority: MiMo (Xiaomi) → OpenAI (fallback).
    """
    import asyncio
    from config.settings import MIMO_API_KEY, MIMO_BASE_URL, OPENAI_API_KEY

    prompt = """Please extract ALL English text visible in this image.
Return ONLY the extracted English text, preserving line breaks and paragraph structure.
Do not add any explanations, translations, or extra commentary.
If no English text is found, respond with 'No English text found.'"""

    from openai import AsyncOpenAI

    # ── Try MiMo first (free, supports vision) ──
    if MIMO_API_KEY and not MIMO_API_KEY.startswith("sk-your-"):
        try:
            client = AsyncOpenAI(
                api_key=MIMO_API_KEY,
                base_url=MIMO_BASE_URL,
                timeout=30.0,
                max_retries=1,
            )
            resp = await client.chat.completions.create(
                model="mimo-v2.5",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }],
                max_tokens=500,
                temperature=0.1,
            )
            return resp.choices[0].message.content or ""
        except Exception:
            pass  # fall through to OpenAI

    # ── Fallback: OpenAI GPT-4o-mini ──
    if not OPENAI_API_KEY or OPENAI_API_KEY.startswith("sk-your-"):
        raise HTTPException(
            status_code=400,
            detail="图片OCR需要配置 API Key。请在 .env 中设置 MIMO_API_KEY（小米 MiMo，推荐）或 OPENAI_API_KEY。"
        )

    try:
        client = AsyncOpenAI(
            api_key=OPENAI_API_KEY,
            timeout=30.0,
            max_retries=1,
        )
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=500,
            temperature=0.1,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        err_msg = str(exc)
        if "timed out" in err_msg.lower() or "timeout" in err_msg.lower():
            raise HTTPException(
                status_code=502,
                detail="图片OCR超时：请尝试上传更小的图片，或检查网络连接。"
            )
        elif "api_key" in err_msg.lower() or "auth" in err_msg.lower():
            raise HTTPException(
                status_code=502,
                detail="API Key 无效，请检查 .env 中的 MIMO_API_KEY 或 OPENAI_API_KEY。"
            )
        else:
            raise HTTPException(
                status_code=502,
                detail=f"图片OCR失败: {err_msg}"
            )
