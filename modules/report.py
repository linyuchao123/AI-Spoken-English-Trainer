"""
Learning Report Generator.
Uses LLM to analyze conversation and produce a structured learning report.
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ReportData:
    session_id: int
    scene_name: str
    difficulty: str
    model: str
    total_rounds: int
    avg_pronunciation_score: float
    created_at: str
    ended_at: str

    # Conversation
    messages: list[dict] = field(default_factory=list)

    # Scores
    scores: list[dict] = field(default_factory=list)

    # Grammar corrections
    corrections: list[dict] = field(default_factory=list)
    error_stats: dict[str, int] = field(default_factory=dict)

    # LLM analysis result
    summary: str = ""
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    topics_covered: list[str] = field(default_factory=list)
    level_assessment: str = ""


def generate_report(data: ReportData) -> ReportData:
    """
    Use LLM to analyze a conversation session and produce a learning report.

    Modifies `data` in-place with LLM-generated analysis.
    Returns the same `data` for chaining.
    """
    if not data.messages:
        data.summary = "No conversation data available."
        data.strengths = []
        data.weaknesses = ["No messages to analyze"]
        data.suggestions = ["Try having a conversation first!"]
        data.topics_covered = []
        data.level_assessment = "N/A"
        return data

    # Build conversation transcript
    transcript = _build_transcript(data.messages)
    stats_summary = _build_stats(data)

    prompt = f"""You are an expert English teacher analyzing a student's speaking practice session.

## Session Info
- Scene: {data.scene_name}
- Difficulty: {data.difficulty}
- Rounds: {data.total_rounds}
- Average Pronunciation Score: {data.avg_pronunciation_score:.0f}/100

## Statistics
{stats_summary}

## Conversation Transcript
{transcript}

## Task
Analyze the student's English conversation performance and return a JSON object with these fields:

- summary (string): 2-3 sentence overview summarizing the student's overall performance
- strengths (string array): 2-3 specific things the student did well (vocabulary, grammar, fluency, etc.)
- weaknesses (string array): 2-3 areas needing improvement, with specific examples from the conversation
- suggestions (string array): 3-4 actionable recommendations for improvement
- topics_covered (string array): Topics discussed in the conversation
- level_assessment (string): A brief assessment of the student's English level (e.g. "Intermediate — good vocabulary but needs work on sentence structure")

IMPORTANT: Respond with ONLY valid JSON. No markdown fences, no explanations.
"""

    try:
        response_text = _call_llm(prompt)
        parsed = _parse_json(response_text)

        data.summary = parsed.get("summary", "Analysis completed.")
        data.strengths = parsed.get("strengths", [])
        data.weaknesses = parsed.get("weaknesses", [])
        data.suggestions = parsed.get("suggestions", [])
        data.topics_covered = parsed.get("topics_covered", [])
        data.level_assessment = parsed.get("level_assessment", "")

    except Exception as exc:
        logger.error("LLM report generation failed: %s", exc)
        data.summary = f"AI analysis unavailable ({str(exc)}). Here are your session statistics."
        data.strengths = []
        data.weaknesses = []
        data.suggestions = ["Practice regularly to improve fluency."]
        data.topics_covered = []
        data.level_assessment = ""

    return data


def _build_transcript(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher"
        content = m["content"][:300]  # Truncate long messages
        lines.append(f"[{role_label}]: {content}")
    return "\n".join(lines)


def _build_stats(data: ReportData) -> str:
    lines = [
        f"- Total messages: {len(data.messages)}",
        f"- User messages: {sum(1 for m in data.messages if m['role'] == 'user')}",
        f"- Pronunciation scores recorded: {len(data.scores)}",
        f"- Grammar corrections: {len(data.corrections)}",
    ]
    if data.error_stats:
        lines.append("- Error type distribution:")
        for err_type, count in data.error_stats.items():
            lines.append(f"  • {err_type}: {count}")
    return "\n".join(lines)


def _call_llm(prompt: str) -> str:
    """Call LLM API with fallback: DeepSeek → OpenAI."""
    import json as _json

    # Try DeepSeek first (free/cheap)
    from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
    if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800, temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            logger.debug("DeepSeek report failed: %s", exc)

    # Fall back to OpenAI
    from config.settings import OPENAI_API_KEY
    if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-your-"):
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800, temperature=0.3,
        )
        return resp.choices[0].message.content or ""

    raise RuntimeError("No LLM API key configured")


def _parse_json(text: str) -> dict:
    import json as _json

    text = text.strip()
    # Remove markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]

    return _json.loads(text)
