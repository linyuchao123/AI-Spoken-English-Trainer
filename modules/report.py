"""
Learning Report Generator.
Uses LLM to produce a comprehensive, bilingual learning report with:
- Per-sentence error analysis (pronunciation, grammar, expression)
- Multi-dimension score breakdown
- Chinese annotations alongside English
- Enriched strengths / improvements / suggestions
"""

import logging
import json as _json
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SentenceAnalysis:
    """Per-user-message analysis item."""
    message_index: int
    original_en: str
    translation_cn: str
    pronunciation_issues: list[str] = field(default_factory=list)  # "word X → should be pronounced Y"
    grammar_issues: list[str] = field(default_factory=list)        # "X → Y (explanation)"
    expression_improvements: list[str] = field(default_factory=list)  # better alternative phrasing


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

    messages: list[dict] = field(default_factory=list)
    scores: list[dict] = field(default_factory=list)
    corrections: list[dict] = field(default_factory=list)
    error_stats: dict[str, int] = field(default_factory=dict)

    # Multi-dimension scores
    grammar_score: float = 0
    vocabulary_score: float = 0
    fluency_score: float = 0
    expression_score: float = 0
    naturalness_score: float = 0
    emotion_score: float = 0

    # LLM analysis
    summary: str = ""
    summary_cn: str = ""
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    topics_covered: list[str] = field(default_factory=list)
    level_assessment: str = ""
    level_assessment_cn: str = ""

    # Per-sentence analysis
    sentence_analyses: list[SentenceAnalysis] = field(default_factory=list)


def generate_report(data: ReportData) -> ReportData:
    """Use LLM to produce a rich, bilingual learning report."""
    if not data.messages:
        data.summary = "No conversation data available."
        data.summary_cn = "无对话数据。"
        return data

    user_messages = [m for m in data.messages if m["role"] == "user"]
    if not user_messages:
        data.summary = "No student speech to analyze."
        data.summary_cn = "没有学生的发言可供分析。"
        return data

    transcript = _build_transcript(data.messages)
    scores_info = _build_scores_info(data)

    prompt = f"""You are a professional English speaking coach producing a detailed bilingual (English + Chinese) learning report.

## Session Info
- Scene: {data.scene_name}
- Difficulty: {data.difficulty}
- Rounds: {data.total_rounds}
- Avg Score: {data.avg_pronunciation_score:.0f}/100

## Multi-dimension Scores
- Grammar: {data.grammar_score:.0f}
- Vocabulary: {data.vocabulary_score:.0f}
- Fluency: {data.fluency_score:.0f}
- Expression: {data.expression_score:.0f}
- Naturalness: {data.naturalness_score:.0f}
- Emotion: {data.emotion_score:.0f}

## Existing Corrections
{scores_info}

## Conversation Transcript
{transcript}

## Task
Return ONLY valid JSON (no markdown) with these fields:

```json
{{
    "summary": "2-3 sentence overall assessment in English",
    "summary_cn": "2-3句中文总体评价",
    "level_assessment": "e.g. Intermediate — good vocabulary, needs sentence structure work",
    "level_assessment_cn": "例如：中级水平 — 词汇量不错，需要加强句型结构",

    "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
    "weaknesses": ["weakness 1 with specific example", "weakness 2 with specific example", "weakness 3", "weakness 4"],
    "suggestions": ["actionable suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"],
    "topics_covered": ["Topic discussed 1", "Topic 2"],

    "sentence_analyses": [
        {{
            "message_index": 0,
            "original_en": "the exact student sentence",
            "translation_cn": "中文翻译",
            "pronunciation_issues": ["word 'comfortable' → should sound like KUMF-tuh-buhl", "word 'th-' → tongue between teeth"],
            "grammar_issues": ["'I go yesterday' → 'I went yesterday' (past tense required)", "'more better' → 'better' (double comparative)"],
            "expression_improvements": ["'I want to ask you something' → 'I'd like to ask you something' (more polite)", "'It's very good' → 'It's excellent / fantastic' (more expressive)"]
        }}
    ]
}}
```

Rules:
- sentence_analyses: analyze EVERY student message. Use message_index 0,1,2... matching order in transcript
- pronunciation_issues: identify likely mispronounced words and describe correct pronunciation in English
- grammar_issues: catch ALL grammar errors with correct form and brief explanation
- expression_improvements: suggest more natural/native-like alternatives even if grammatically correct
- If no issues in a category, use empty array []
- Provide at least 4 items each for strengths, weaknesses, suggestions
- All fields must be present
- Use specific examples from the conversation, not generic advice
- Keep pronunciation/grammar descriptions in English (they're teaching reference)

IMPORTANT: Respond with ONLY the JSON object. No markdown fences. No extra text.
"""

    try:
        response_text = _call_llm(prompt, max_tokens=3000)
        parsed = _parse_json(response_text)

        data.summary = parsed.get("summary", "")
        data.summary_cn = parsed.get("summary_cn", "")
        data.level_assessment = parsed.get("level_assessment", "")
        data.level_assessment_cn = parsed.get("level_assessment_cn", "")
        data.strengths = parsed.get("strengths", [])
        data.weaknesses = parsed.get("weaknesses", [])
        data.suggestions = parsed.get("suggestions", [])
        data.topics_covered = parsed.get("topics_covered", [])

        # Parse sentence analyses
        analyses_raw = parsed.get("sentence_analyses", [])
        data.sentence_analyses = [
            SentenceAnalysis(
                message_index=a.get("message_index", i),
                original_en=a.get("original_en", ""),
                translation_cn=a.get("translation_cn", ""),
                pronunciation_issues=a.get("pronunciation_issues", []),
                grammar_issues=a.get("grammar_issues", []),
                expression_improvements=a.get("expression_improvements", []),
            )
            for i, a in enumerate(analyses_raw)
        ]

    except Exception as exc:
        logger.error("LLM report generation failed: %s", exc)
        data.summary = f"AI analysis unavailable ({str(exc)})."
        data.summary_cn = f"AI分析暂时不可用。"
        data.strengths = []
        data.weaknesses = ["AI analysis failed — please try again"]
        data.suggestions = ["Try generating the report again"]
        data.sentence_analyses = []

    return data


def _build_transcript(messages: list[dict]) -> str:
    lines = []
    for i, m in enumerate(messages):
        role_label = "Student" if m["role"] == "user" else "Teacher"
        idx_str = f"[{i}]" if m["role"] == "user" else ""
        lines.append(f"{idx_str}[{role_label}]: {m['content'][:400]}")
    return "\n".join(lines)


def _build_scores_info(data: ReportData) -> str:
    lines = [
        f"- Grammar score: {data.grammar_score:.0f}/100",
        f"- Vocabulary score: {data.vocabulary_score:.0f}/100",
        f"- Fluency score: {data.fluency_score:.0f}/100",
        f"- Expression score: {data.expression_score:.0f}/100",
        f"- Naturalness score: {data.naturalness_score:.0f}/100",
        f"- Emotion score: {data.emotion_score:.0f}/100",
    ]
    if data.error_stats:
        lines.append("- Error distribution:")
        for err_type, count in data.error_stats.items():
            lines.append(f"  {err_type}: {count}")
    return "\n".join(lines)


def _call_llm(prompt: str, max_tokens: int = 3000) -> str:
    """Call LLM with fallback: DeepSeek → OpenAI."""
    from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

    if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens, temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            logger.debug("DeepSeek report failed: %s", exc)

    from config.settings import OPENAI_API_KEY
    if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-your-"):
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens, temperature=0.3,
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
