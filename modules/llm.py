"""
LLM conversation engine — supports OpenAI GPT-4o and DeepSeek dual models.
Provides client factory, model name resolution, and reply generation with
scene×difficulty contextual prompts.
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
    OPENAI_LLM_MODEL,
    DEEPSEEK_LLM_MODEL,
)
from config.prompts import SCENE_PROMPTS


def get_llm_client(model_type: str = "openai") -> OpenAI:
    """Factory: return an OpenAI-compatible client for the chosen model.

    Args:
        model_type: ``"openai"`` or ``"deepseek"``.

    Returns:
        Configured OpenAI client instance.

    Raises:
        ValueError: If the required API key is missing from the environment.
    """
    if model_type == "deepseek":
        if not DEEPSEEK_API_KEY:
            raise ValueError(
                "DEEPSEEK_API_KEY is not configured. "
                "Set it in your .env file or environment variables."
            )
        return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

    # Default: OpenAI
    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not configured. "
            "Set it in your .env file or environment variables."
        )
    return OpenAI(api_key=OPENAI_API_KEY)


def get_model_name(model_type: str = "openai") -> str:
    """Resolve the LLM model identifier for the given provider."""
    if model_type == "deepseek":
        return DEEPSEEK_LLM_MODEL
    return OPENAI_LLM_MODEL


def generate_reply(
    messages_history: list[dict],
    scene_key: str,
    difficulty: str,
    model_type: str = "openai",
) -> str:
    """Generate an AI conversation reply using the scene×difficulty prompt.

    Args:
        messages_history:
            Ordered list of recent messages, each as
            ``{"role": "user"|"ai", "content": "..."}``.
        scene_key:
            One of ``"job_interview"``, ``"restaurant"``, ``"business_meeting"``.
        difficulty:
            One of ``"beginner"``, ``"intermediate"``, ``"advanced"``.
        model_type:
            ``"openai"`` (default) or ``"deepseek"``.

    Returns:
        The AI assistant's reply as a plain English string.

    Raises:
        ValueError: If the scene key or difficulty is unknown.
        openai.APIError: If the LLM API call fails.
    """
    # ── Resolve scene prompt ──────────────────────────────────────────
    scene_prompts = SCENE_PROMPTS.get(scene_key)
    if scene_prompts is None:
        raise ValueError(f"Unknown scene key: {scene_key!r}")

    prompt_config = scene_prompts.get(difficulty)
    if prompt_config is None:
        raise ValueError(
            f"Unknown difficulty {difficulty!r} for scene {scene_key!r}"
        )

    system_prompt = prompt_config["system_prompt"]

    # ── Build message list for LLM ────────────────────────────────────
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in messages_history:
        role = "assistant" if msg["role"] == "ai" else "user"
        messages.append({"role": role, "content": msg["content"]})

    # ── Call LLM ──────────────────────────────────────────────────────
    client = get_llm_client(model_type)
    model_name = get_model_name(model_type)

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=0.7,
        max_tokens=200,
    )

    return response.choices[0].message.content
