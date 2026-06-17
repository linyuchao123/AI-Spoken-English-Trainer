"""
Grammar correction engine — analyses English text for grammatical errors
using the configured LLM and returns structured corrections.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.prompts import GRAMMAR_CORRECTION_PROMPT, GRAMMAR_MAX_TOKENS_MULTIPLIER
from modules.llm import get_llm_client, _resolve_model_config


def correct_grammar(
    text: str,
    model_key: str = "gpt-4o",
) -> dict:
    """Analyse *text* for grammar / vocabulary / word-order errors.

    Args:
        text: The English sentence to check.
        model_key: Any key from ``LLM_MODELS``.

    Returns:
        A dict with keys:
        - ``has_errors``: bool
        - ``original``: str
        - ``corrected``: str
        - ``errors``: list[dict] with keys type, original_text, corrected_text, explanation, explanation_cn, better_expression
        - ``expression_improvements``: list[dict] with keys original_phrase, improved_phrase, explanation, explanation_cn

    Raises:
        ValueError: If the LLM response cannot be parsed.
    """
    cfg = _resolve_model_config(model_key)
    client = get_llm_client(model_key)

    prompt = GRAMMAR_CORRECTION_PROMPT.format(user_text=text)

    base_max_tokens = max(4000, len(text) * GRAMMAR_MAX_TOKENS_MULTIPLIER)
    raw = ""

    # First attempt (may fail for reasoning models that exhaust tokens on thinking)
    response = client.chat.completions.create(
        model=cfg["model_id"],
        messages=[
            {"role": "system", "content": "You are a grammar checking assistant. Respond ONLY with valid JSON, no extra text."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=base_max_tokens,
    )
    raw = (response.choices[0].message.content or "").strip()

    # If content is empty (reasoning model consumed all tokens), retry with much higher limit
    if not raw:
        response = client.chat.completions.create(
            model=cfg["model_id"],
            messages=[
                {"role": "system", "content": "You are a grammar checking assistant. Respond ONLY with valid JSON, no extra text."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=base_max_tokens * 2,
        )
        raw = (response.choices[0].message.content or "").strip()

    if not raw:
        raise ValueError(
            f"LLM returned empty response (likely a reasoning model exhausted tokens). "
            f"Please try a different model (e.g. DeepSeek or GPT-4o) for grammar checking."
        )

    # ── Robust JSON extraction ──
    # 1. Strip markdown code fences (```json ... ```, ``` ... ```, etc.)
    import re
    fence_match = re.match(r"```(?:json|JSON)?\s*\n?(.*?)```", raw, re.DOTALL)
    if fence_match:
        raw = fence_match.group(1).strip()
    elif raw.startswith("```"):
        # Simple case: starts with ``` but no closing fence found by regex
        lines = raw.split("\n")
        if len(lines) > 1:
            raw = "\n".join(lines[1:])  # drop first line (``` or ```json)
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    # 2. Try to find JSON object in the response (handles extra text before/after)
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)

    # 3. Parse
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(
            f"Failed to parse grammar correction response as JSON. Raw: {raw[:500]}"
        )

    # Normalise keys
    return {
        "has_errors": result.get("has_errors", False),
        "original": result.get("original", text),
        "corrected": result.get("corrected", text),
        "errors": result.get("errors", []),
        "expression_improvements": result.get("expression_improvements", []),
    }
