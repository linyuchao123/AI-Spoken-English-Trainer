"""
Multi-dimension Session Evaluation.
Uses LLM to score a conversation across 6 dimensions:
grammar, vocabulary, fluency, expression, naturalness, emotion.
"""

import logging
import json as _json
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    overall_score: float = 0
    grammar_score: float = 0
    vocabulary_score: float = 0
    fluency_score: float = 0
    expression_score: float = 0
    naturalness_score: float = 0
    emotion_score: float = 0
    summary: str = ""
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


def evaluate_session(
    messages: list[dict],
    scene_name: str,
    difficulty: str,
    total_rounds: int,
) -> EvaluationResult:
    """
    Evaluate a conversation session using LLM across 6 dimensions.

    Returns an EvaluationResult with scores and feedback.
    """
    result = EvaluationResult()

    if not messages:
        result.summary = "No conversation data to evaluate."
        return result

    user_messages = [m for m in messages if m["role"] == "user"]
    ai_messages = [m for m in messages if m["role"] == "ai"]

    if not user_messages:
        result.summary = "No student speech to evaluate."
        return result

    transcript = _build_transcript(messages)

    prompt = f"""You are a professional English speaking coach evaluating a student's conversation performance. 

## Session Info
- Scene: {scene_name}
- Difficulty: {difficulty}
- Total rounds (student turns): {total_rounds}

## Conversation Transcript
{transcript}

## Task
Analyze the student's English conversation and score each dimension on a 0-100 scale.
Return ONLY a JSON object (no markdown, no explanations) with exactly these fields:

{{
    "overall_score": <0-100 overall assessment>,
    "grammar_score": <0-100 grammatical accuracy and variety>,
    "vocabulary_score": <0-100 vocabulary richness, precision, and appropriateness>,
    "fluency_score": <0-100 smoothness, pacing, and avoidance of hesitation patterns>,
    "expression_score": <0-100 clarity, logic, and effectiveness of expressing ideas>,
    "naturalness_score": <0-100 how natural and native-like the phrasing sounds>,
    "emotion_score": <0-100 use of tone, enthusiasm, and emotional engagement in conversation>,
    "summary": "<2-3 sentence overall assessment in English>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}}

Scoring guidelines:
- 90-100: Excellent / Near-native
- 75-89: Good / Confident communicator
- 60-74: Fair / Gets message across with some errors
- 40-59: Basic / Struggles with complex ideas
- 0-39: Beginner / Needs significant improvement

Be fair and constructive. Match scores to the actual difficulty level and performance shown.
If there are very few student messages, scale scores proportionally rather than penalizing heavily.
IMPORTANT: Respond with ONLY valid JSON. No code fences, no extra text.
"""

    try:
        response_text = _call_llm(prompt)
        parsed = _parse_json(response_text)

        result.overall_score = max(0, min(100, float(parsed.get("overall_score", 50))))
        result.grammar_score = max(0, min(100, float(parsed.get("grammar_score", 50))))
        result.vocabulary_score = max(0, min(100, float(parsed.get("vocabulary_score", 50))))
        result.fluency_score = max(0, min(100, float(parsed.get("fluency_score", 50))))
        result.expression_score = max(0, min(100, float(parsed.get("expression_score", 50))))
        result.naturalness_score = max(0, min(100, float(parsed.get("naturalness_score", 50))))
        result.emotion_score = max(0, min(100, float(parsed.get("emotion_score", 50))))
        result.summary = parsed.get("summary", "Evaluation completed.")
        result.strengths = parsed.get("strengths", [])
        result.weaknesses = parsed.get("weaknesses", [])
        result.suggestions = parsed.get("suggestions", [])

        logger.info("Evaluation complete: overall=%.0f, grammar=%.0f, vocabulary=%.0f",
                     result.overall_score, result.grammar_score, result.vocabulary_score)

    except Exception as exc:
        logger.error("LLM evaluation failed: %s", exc)
        result.summary = f"AI evaluation unavailable. Your score is based on {len(user_messages)} responses."
        # Fallback: give moderate default scores based on participation
        participation = min(len(user_messages) / max(total_rounds, 1), 1.0)
        result.overall_score = round(50 + participation * 20, 1)
        result.grammar_score = 50
        result.vocabulary_score = 50
        result.fluency_score = 50
        result.expression_score = 50
        result.naturalness_score = 50
        result.emotion_score = 50

    return result


def _build_transcript(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher"
        content = m["content"][:400]
        lines.append(f"[{role_label}]: {content}")
    return "\n".join(lines)


def _call_llm(prompt: str) -> str:
    """Call LLM with fallback: DeepSeek → OpenAI."""
    from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

    if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000, temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            logger.debug("DeepSeek evaluation failed: %s", exc)

    from config.settings import OPENAI_API_KEY
    if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-your-"):
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000, temperature=0.3,
        )
        return resp.choices[0].message.content or ""

    raise RuntimeError("No LLM API key configured")


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
    return _json.loads(text)
