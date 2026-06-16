"""
Unified LangChain LLM Factory.

Provides a single interface for creating ChatOpenAI / ChatDeepSeek instances
with built-in DeepSeek -> OpenAI fallback chain.

Replaces the duplicated `_call_llm()` / `_parse_json()` patterns scattered
across modules/pronunciation.py, evaluation.py, report.py, and sessions.py.
"""

import logging
import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================
# Environment config (read once at import time)
# ============================================================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Model IDs
OPENAI_MODEL = "gpt-4o-mini"       # Cost-effective fallback
DEEPSEEK_MODEL = "deepseek-chat"   # Primary (cheap)


# ============================================================
# Factory functions
# ============================================================

def get_chat_model(
    provider: str = "auto",
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> "ChatOpenAI":
    """
    Return a LangChain ChatOpenAI instance.

    Args:
        provider:
            "deepseek"  — force DeepSeek
            "openai"    — force OpenAI GPT-4o-mini
            "auto"      — DeepSeek if key configured, else OpenAI
        temperature: Sampling temperature (lower = more deterministic).
        max_tokens:  Max output tokens.

    Returns:
        A langchain_openai.ChatOpenAI instance (works for both providers
        since DeepSeek exposes an OpenAI-compatible API).

    Raises:
        RuntimeError: If no API key is configured for either provider.
    """
    from langchain_openai import ChatOpenAI

    if provider == "auto":
        provider = "deepseek" if _deepseek_available() else "openai"

    if provider == "deepseek":
        if not _deepseek_available():
            logger.warning("DeepSeek requested but not configured; falling back to OpenAI.")
            provider = "openai"
        else:
            return ChatOpenAI(
                model=DEEPSEEK_MODEL,
                api_key=DEEPSEEK_API_KEY,
                base_url=DEEPSEEK_BASE_URL,
                temperature=temperature,
                max_tokens=max_tokens,
            )

    if provider == "openai":
        if not _openai_available():
            raise RuntimeError(
                "No LLM API key configured. Set OPENAI_API_KEY or DEEPSEEK_API_KEY in .env"
            )
        return ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    raise ValueError(f"Unknown provider: {provider!r}. Use 'deepseek', 'openai', or 'auto'.")


def get_fallback_model(
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> "ChatOpenAI":
    """
    Return a LangChain ChatOpenAI that tries DeepSeek first, then falls back to OpenAI.

    This uses LangChain's built-in fallback mechanism via the `.with_fallbacks()`
    method. When the primary model raises any exception, LangChain automatically
    retries with the fallback model.

    Returns:
        A ChatOpenAI with fallback chain configured.
    """
    from langchain_openai import ChatOpenAI

    models = []

    # Primary: DeepSeek (cheapest)
    if _deepseek_available():
        models.append(
            ChatOpenAI(
                model=DEEPSEEK_MODEL,
                api_key=DEEPSEEK_API_KEY,
                base_url=DEEPSEEK_BASE_URL,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        )

    # Fallback: OpenAI
    if _openai_available():
        models.append(
            ChatOpenAI(
                model=OPENAI_MODEL,
                api_key=OPENAI_API_KEY,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        )

    if not models:
        raise RuntimeError(
            "No LLM API key configured. Set OPENAI_API_KEY or DEEPSEEK_API_KEY in .env"
        )

    if len(models) == 1:
        return models[0]

    # First model gets the rest as fallbacks
    primary = models[0]
    fallbacks = models[1:]
    return primary.with_fallbacks(fallbacks)


def get_model_for_key(model_key: str, temperature: float = 0.7, max_tokens: int = 200) -> "ChatOpenAI":
    """
    Create a ChatOpenAI for a specific model_key from config.settings.LLM_MODELS.

    Used by the conversation engine (modules/llm.py) where the user explicitly
    selects a model (gpt-4o, gpt-4o-mini, deepseek-chat).

    Args:
        model_key: Key from LLM_MODELS dict (e.g. 'gpt-4o', 'deepseek-chat').
        temperature: Sampling temperature.
        max_tokens: Max output tokens.

    Returns:
        ChatOpenAI instance configured for the requested model.
    """
    from langchain_openai import ChatOpenAI
    from config.settings import LLM_MODELS

    cfg = LLM_MODELS.get(model_key)
    if cfg is None:
        raise ValueError(
            f"Unknown model key: {model_key!r}. "
            f"Available: {list(LLM_MODELS.keys())}"
        )

    provider = cfg["provider"]
    model_id = cfg["model_id"]

    if provider == "deepseek":
        if not DEEPSEEK_API_KEY:
            raise ValueError("DEEPSEEK_API_KEY is not configured.")
        return ChatOpenAI(
            model=model_id,
            api_key=DEEPSEEK_API_KEY,
            base_url=DEEPSEEK_BASE_URL,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    # Default: OpenAI
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured.")
    return ChatOpenAI(
        model=model_id,
        api_key=OPENAI_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
    )


# ============================================================
# Internal helpers
# ============================================================

def _deepseek_available() -> bool:
    return bool(DEEPSEEK_API_KEY) and not DEEPSEEK_API_KEY.startswith("sk-your-")


def _openai_available() -> bool:
    return bool(OPENAI_API_KEY) and not OPENAI_API_KEY.startswith("sk-your-")


def any_llm_available() -> bool:
    """Return True if at least one LLM provider is configured."""
    return _deepseek_available() or _openai_available()
