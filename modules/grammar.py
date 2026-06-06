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
        - ``errors``: list[dict] with keys type, original_text, corrected_text, explanation

    Raises:
        ValueError: If the LLM response cannot be parsed.
    """
    cfg = _resolve_model_config(model_key)
    client = get_llm_client(model_key)

    prompt = GRAMMAR_CORRECTION_PROMPT.format(user_text=text)

    response = client.chat.completions.create(
        model=cfg["model_id"],
        messages=[
            {"role": "system", "content": "You are a grammar checking assistant. Respond ONLY with valid JSON, no extra text."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,  # low temperature for deterministic corrections
        max_tokens=max(500, len(text) * GRAMMAR_MAX_TOKENS_MULTIPLIER),
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(
            f"Failed to parse grammar correction response as JSON. Raw: {raw[:200]}"
        )

    # Normalise keys
    return {
        "has_errors": result.get("has_errors", False),
        "original": result.get("original", text),
        "corrected": result.get("corrected", text),
        "errors": result.get("errors", []),
    }
