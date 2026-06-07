"""
Pronunciation Assessment engine using LLM text comparison (DeepSeek → OpenAI).

Flow:
  1. Frontend uses Web Speech API to recognize spoken text
  2. Backend receives recognized_text + reference_text
  3. LLM compares them and returns structured pronunciation scores + word-level feedback
"""

import logging
import json as _json
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class WordScore:
    word: str
    accuracy_score: float
    error_type: str  # "None", "Omission", "Insertion", "Mispronunciation"


@dataclass
class PronunciationResult:
    accuracy_score: float       # 0-100
    fluency_score: float        # 0-100
    completeness_score: float   # 0-100
    overall_score: float        # 0-100
    words: list[WordScore] = field(default_factory=list)
    error: str = ""


def assess(recognized_text: str, reference_text: str) -> PronunciationResult:
    """
    Assess pronunciation by comparing recognized text with reference text using LLM.

    Args:
        recognized_text: Text recognized by Web Speech API from user's speech.
        reference_text: The expected/reference text the user should have said.

    Returns:
        PronunciationResult with scores and word-level details.
    """
    if not recognized_text.strip():
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="未检测到语音，请重试",
        )

    if not reference_text.strip():
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="参考文本不能为空",
        )

    prompt = _build_prompt(recognized_text, reference_text)

    try:
        response_text = _call_llm(prompt)
        parsed = _parse_json(response_text)
        return _build_result(parsed)
    except Exception as exc:
        logger.error("Pronunciation assessment failed: %s", exc)
        # Fallback: simple text diff scoring
        return _fallback_assess(recognized_text, reference_text)


def _build_prompt(recognized: str, reference: str) -> str:
    return f"""You are an English pronunciation assessor. Compare what the student SAID (recognized by speech recognition) with what they SHOULD HAVE SAID (reference text).

## Reference Text (expected)
"{reference}"

## Recognized Text (what speech recognition captured)
"{recognized}"

## Task
Analyze the differences and score the pronunciation. Consider:
- **accuracy_score** (0-100): How closely the recognized words match the reference. Wrong words, extra words, missing words all reduce score.
- **fluency_score** (0-100): Based on completeness and natural flow. If the student said all words without major gaps, score higher.
- **completeness_score** (0-100): What percentage of reference words were captured. Missing words reduce this score.

For EACH word in the reference text, provide a word-level analysis:
- word: the reference word
- accuracy_score: 0-100 score for how well this word was pronounced (100 if correctly recognized, lower if wrong/missing)
- error_type: one of "None" (correct), "Omission" (skipped), "Insertion" (extra word not in reference), "Mispronunciation" (wrong word recognized)

Return ONLY a JSON object with this exact structure:
{{
  "accuracy_score": <number>,
  "fluency_score": <number>,
  "completeness_score": <number>,
  "words": [
    {{"word": "<word>", "accuracy_score": <number>, "error_type": "<type>"}},
    ...
  ]
}}

IMPORTANT: Respond with ONLY valid JSON. No markdown fences, no explanations.
"""


def _build_result(parsed: dict) -> PronunciationResult:
    words = []
    for w in parsed.get("words", []):
        words.append(WordScore(
            word=w.get("word", ""),
            accuracy_score=float(w.get("accuracy_score", 0)),
            error_type=w.get("error_type", "None"),
        ))

    acc = float(parsed.get("accuracy_score", 0))
    flu = float(parsed.get("fluency_score", 0))
    comp = float(parsed.get("completeness_score", 0))
    overall = (acc + flu + comp) / 3

    return PronunciationResult(
        accuracy_score=acc,
        fluency_score=flu,
        completeness_score=comp,
        overall_score=overall,
        words=words,
    )


def _fallback_assess(recognized: str, reference: str) -> PronunciationResult:
    """Simple text-diff scoring when LLM is unavailable."""
    ref_words = reference.lower().split()
    rec_words = recognized.lower().split()

    # Simple word matching
    matched = 0
    words = []
    for i, rw in enumerate(ref_words):
        # Clean punctuation for comparison
        clean_ref = rw.strip(".,!?;:'\"()").lower()
        clean_rec = rec_words[i].strip(".,!?;:'\"()").lower() if i < len(rec_words) else ""

        if clean_ref == clean_rec:
            matched += 1
            words.append(WordScore(word=rw, accuracy_score=100, error_type="None"))
        elif clean_rec == "":
            words.append(WordScore(word=rw, accuracy_score=0, error_type="Omission"))
        else:
            words.append(WordScore(word=rw, accuracy_score=30, error_type="Mispronunciation"))

    # Check for extra words (insertions)
    for i in range(len(ref_words), len(rec_words)):
        words.append(WordScore(word=rec_words[i], accuracy_score=0, error_type="Insertion"))

    completeness = (matched / len(ref_words) * 100) if ref_words else 0
    accuracy = completeness * 0.9  # Slightly penalize for not using LLM
    fluency = completeness * 0.85

    return PronunciationResult(
        accuracy_score=round(accuracy, 1),
        fluency_score=round(fluency, 1),
        completeness_score=round(completeness, 1),
        overall_score=round((accuracy + fluency + completeness) / 3, 1),
        words=words,
    )


def _call_llm(prompt: str) -> str:
    """Call LLM API with fallback: DeepSeek → OpenAI."""
    from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
    if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600, temperature=0.2,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            logger.debug("DeepSeek pronunciation failed: %s", exc)

    from config.settings import OPENAI_API_KEY
    if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-your-"):
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600, temperature=0.2,
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
