"""
LLM conversation engine — multi-model support with per-model style injection
and dynamic opening-line generation.

Supported models are configured in :mod:`config.settings.LLM_MODELS`.
Each model has a ``style`` hint that is appended to the system prompt to give
each model a distinct conversational personality.
"""

import os
import sys

# Add project root to Python path for config imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openai import OpenAI
from config.settings import (
    OPENAI_API_KEY,
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    LLM_MODELS,
)
from config.prompts import SCENE_PROMPTS


# ============================================================
# Client helpers
# ============================================================

def _resolve_model_config(model_key: str) -> dict:
    """Look up a model entry in LLM_MODELS.  Raises ValueError on miss."""
    cfg = LLM_MODELS.get(model_key)
    if cfg is None:
        raise ValueError(
            f"Unknown model key: {model_key!r}. "
            f"Available: {list(LLM_MODELS.keys())}"
        )
    return cfg


def get_llm_client(model_key: str) -> OpenAI:
    """Factory: return an OpenAI-compatible client for *model_key*."""
    cfg = _resolve_model_config(model_key)
    provider = cfg["provider"]

    if provider == "deepseek":
        if not DEEPSEEK_API_KEY:
            raise ValueError(
                "DEEPSEEK_API_KEY is not configured. "
                "Set it in your .env file or environment variables."
            )
        return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

    # provider == "openai" (or future providers defaulting to OpenAI)
    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not configured. "
            "Set it in your .env file or environment variables."
        )
    return OpenAI(api_key=OPENAI_API_KEY)


# ============================================================
# Core generation
# ============================================================

def _build_system_prompt(scene_key: str, difficulty: str, model_key: str) -> str:
    """Build the full system prompt: scene×difficulty prompt + model style."""
    scene_prompts = SCENE_PROMPTS.get(scene_key)
    if scene_prompts is None:
        raise ValueError(f"Unknown scene key: {scene_key!r}")

    prompt_config = scene_prompts.get(difficulty)
    if prompt_config is None:
        raise ValueError(
            f"Unknown difficulty {difficulty!r} for scene {scene_key!r}"
        )

    cfg = _resolve_model_config(model_key)
    style_hint = cfg.get("style", "")

    base_prompt = prompt_config["system_prompt"]
    if style_hint:
        return f"{base_prompt}\n\n[SPEAKING STYLE]: {style_hint}"
    return base_prompt


def generate_reply(
    messages_history: list[dict],
    scene_key: str,
    difficulty: str,
    model_key: str = "gpt-4o",
) -> str:
    """Generate an AI conversation reply.

    Args:
        messages_history:
            Ordered list of ``{"role": "user"|"ai", "content": "..."}``.
        scene_key:
            ``"job_interview"`` | ``"restaurant"`` | ``"business_meeting"``.
        difficulty:
            ``"beginner"`` | ``"intermediate"`` | ``"advanced"``.
        model_key:
            Any key from ``LLM_MODELS`` (e.g. ``"gpt-4o"``, ``"deepseek-chat"``).

    Returns:
        The AI assistant's reply as a plain English string.
    """
    system_prompt = _build_system_prompt(scene_key, difficulty, model_key)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in messages_history:
        role = "assistant" if msg["role"] == "ai" else "user"
        messages.append({"role": role, "content": msg["content"]})

    cfg = _resolve_model_config(model_key)
    client = get_llm_client(model_key)

    response = client.chat.completions.create(
        model=cfg["model_id"],
        messages=messages,
        temperature=0.7,
        max_tokens=200,
    )
    return response.choices[0].message.content


# ============================================================
# Dynamic opening lines
# ============================================================

def generate_opening(
    scene_key: str,
    difficulty: str,
    model_key: str = "gpt-4o",
) -> str:
    """Generate a unique AI opening line tailored to scene, difficulty, and model.

    Instead of using a hard-coded ``first_message``, this calls the LLM with a
    special "generate opening" instruction so that **every model produces a
    different opening greeting** for the same scene×difficulty combination.

    Args:
        scene_key / difficulty / model_key:
            Same as :func:`generate_reply`.

    Returns:
        A one- or two-sentence English opening line.
    """
    # ── Get scene meta for context ──────────────────────────────────
    scene_prompts = SCENE_PROMPTS.get(scene_key)
    if scene_prompts is None:
        raise ValueError(f"Unknown scene key: {scene_key!r}")
    prompt_config = scene_prompts.get(difficulty)
    if prompt_config is None:
        raise ValueError(
            f"Unknown difficulty {difficulty!r} for scene {scene_key!r}"
        )

    cfg = _resolve_model_config(model_key)
    style_hint = cfg.get("style", "")

    # ── Build the opening-generation system prompt ──────────────────
    scene_desc = prompt_config["system_prompt"][:500]  # summary for context
    opening_prompt = (
        f"{scene_desc}\n\n"
        f"You are about to start a conversation. "
        f"Generate a single natural opening greeting (1-2 sentences only) "
        f"to begin the interaction. Do NOT include explanations or notes — "
        f"output ONLY the greeting itself."
    )
    if style_hint:
        opening_prompt += f"\n\n[SPEAKING STYLE]: {style_hint}"

    # ── Call LLM ────────────────────────────────────────────────────
    client = get_llm_client(model_key)
    response = client.chat.completions.create(
        model=cfg["model_id"],
        messages=[
            {"role": "system", "content": opening_prompt},
            {"role": "user", "content": "Start the conversation now."},
        ],
        temperature=0.9,  # higher for creative variety
        max_tokens=80,
    )
    return response.choices[0].message.content.strip()
