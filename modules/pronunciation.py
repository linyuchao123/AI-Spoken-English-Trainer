"""
Pronunciation Assessment engine using LLM text comparison (DeepSeek → OpenAI).

Multi-dimension analysis: accuracy, fluency, completeness, stress, intonation,
phoneme-level feedback, and per-word detailed scoring with bilingual corrections.
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
    expected_pronunciation: str = ""  # e.g. "KUMF-tuh-buhl"
    correction_cn: str = ""           # e.g. "应该发成 /ˈkʌmf.tə.bəl/，注意重音在第一个音节"


@dataclass
class PronunciationResult:
    # Core scores
    accuracy_score: float       # 0-100
    fluency_score: float        # 0-100
    completeness_score: float   # 0-100
    overall_score: float        # 0-100

    # Extended scores
    stress_score: float = 0          # word stress / sentence stress
    intonation_score: float = 0      # rising/falling intonation patterns
    rhythm_score: float = 0          # natural rhythm / timing

    # Word-level detail
    words: list[WordScore] = field(default_factory=list)

    # Phoneme analysis
    phoneme_highlights: list[str] = field(default_factory=list)
    # e.g. "th sound /θ/: you said 'd' instead — practice tongue between teeth"

    # Summary & suggestions
    summary_en: str = ""    # Overall assessment in English
    summary_cn: str = ""    # 总体评价
    suggestions: list[str] = field(default_factory=list)  # Actionable tips (bilingual)

    error: str = ""


def assess(recognized_text: str, reference_text: str) -> PronunciationResult:
    """Assess pronunciation by comparing recognized text with reference text using LLM."""

    if not recognized_text.strip():
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="未检测到语音，请重试 / No speech detected",
        )

    if not reference_text.strip():
        return PronunciationResult(
            accuracy_score=0, fluency_score=0, completeness_score=0,
            overall_score=0, error="参考文本不能为空 / Reference text required",
        )

    prompt = _build_prompt(recognized_text, reference_text)

    try:
        response_text = _call_llm(prompt, max_tokens=1500)
        parsed = _parse_json(response_text)
        return _build_result(parsed)
    except Exception as exc:
        logger.error("Pronunciation assessment failed: %s", exc)
        return _fallback_assess(recognized_text, reference_text)


def _build_prompt(recognized: str, reference: str) -> str:
    return f"""You are a professional English pronunciation coach analyzing a student's speech.

## Reference Text (what the student should read)
"{reference}"

## Recognized Text (what speech recognition captured from the student)
"{recognized}"

## Multi-Dimension Scoring (0-100 each)
Analyze the pronunciation across these dimensions:

1. **accuracy_score**: How correctly each word was pronounced compared to reference.
2. **fluency_score**: Smoothness, natural pausing, lack of hesitation or choppiness.
3. **completeness_score**: How much of the reference text was actually spoken (no skipped words/sections).
4. **stress_score**: Correct word stress and sentence stress patterns. Misplaced stress on syllables.
5. **intonation_score**: Appropriate rising/falling intonation, not monotone.
6. **rhythm_score**: Natural English rhythm and timing between words/syllables.

## Word-Level Analysis
For EACH word in the reference text, provide:
- word: the reference word
- accuracy_score: 0-100
- error_type: "None" | "Omission" | "Insertion" | "Mispronunciation"
- expected_pronunciation: A simple phonetic hint in English (e.g. "KUMF-tuh-buhl" for comfortable), empty if correct
- correction_cn: Chinese explanation if wrong (e.g. "comfortable 发音为 KUMF-tuh-buhl，注意重音在第一音节"), empty if correct

## Phoneme Highlights
List 2-4 key phoneme-level issues discovered, each as a concise English explanation.
Example: "th sound /θ/: you said 's' — practice placing tongue between teeth"

## Summary & Suggestions
- summary_en: 2-3 sentence overall assessment in English
- summary_cn: 2-3 sentence overall assessment in Chinese (中文总体评价)
- suggestions: 3-5 specific, actionable improvement tips (mix of English/Chinese)

## Response Format
Return ONLY a JSON object (no markdown fences):

{{
  "accuracy_score": <0-100>,
  "fluency_score": <0-100>,
  "completeness_score": <0-100>,
  "stress_score": <0-100>,
  "intonation_score": <0-100>,
  "rhythm_score": <0-100>,
  "words": [
    {{
      "word": "<word>",
      "accuracy_score": <0-100>,
      "error_type": "<None|Omission|Insertion|Mispronunciation>",
      "expected_pronunciation": "<phonetic hint or empty>",
      "correction_cn": "<Chinese correction or empty>"
    }}
  ],
  "phoneme_highlights": ["..."],
  "summary_en": "...",
  "summary_cn": "...",
  "suggestions": ["..."]
}}

IMPORTANT: Compare the recognized text AGAINST the reference text. If words differ, note it.
Respond with ONLY the JSON. No extra text.
"""


def _build_result(parsed: dict) -> PronunciationResult:
    words = []
    for w in parsed.get("words", []):
        words.append(WordScore(
            word=w.get("word", ""),
            accuracy_score=float(w.get("accuracy_score", 0)),
            error_type=w.get("error_type", "None"),
            expected_pronunciation=w.get("expected_pronunciation", ""),
            correction_cn=w.get("correction_cn", ""),
        ))

    acc = float(parsed.get("accuracy_score", 0))
    flu = float(parsed.get("fluency_score", 0))
    comp = float(parsed.get("completeness_score", 0))
    stress = float(parsed.get("stress_score", 0))
    intonation = float(parsed.get("intonation_score", 0))
    rhythm = float(parsed.get("rhythm_score", 0))
    overall = (acc + flu + comp + stress + intonation + rhythm) / 6

    return PronunciationResult(
        accuracy_score=acc,
        fluency_score=flu,
        completeness_score=comp,
        overall_score=overall,
        stress_score=stress,
        intonation_score=intonation,
        rhythm_score=rhythm,
        words=words,
        phoneme_highlights=parsed.get("phoneme_highlights", []),
        summary_en=parsed.get("summary_en", ""),
        summary_cn=parsed.get("summary_cn", ""),
        suggestions=parsed.get("suggestions", []),
    )


def _fallback_assess(recognized: str, reference: str) -> PronunciationResult:
    """Simple text-diff scoring when LLM is unavailable."""
    ref_words = reference.lower().split()
    rec_words = recognized.lower().split()

    matched = 0
    words = []
    for i, rw in enumerate(ref_words):
        clean_ref = rw.strip(".,!?;:'\"()").lower()
        clean_rec = rec_words[i].strip(".,!?;:'\"()").lower() if i < len(rec_words) else ""

        if clean_ref == clean_rec:
            matched += 1
            words.append(WordScore(word=rw, accuracy_score=100, error_type="None"))
        elif clean_rec == "":
            words.append(WordScore(word=rw, accuracy_score=0, error_type="Omission",
                                    correction_cn="漏读了此词"))
        else:
            words.append(WordScore(word=rw, accuracy_score=30, error_type="Mispronunciation",
                                    expected_pronunciation=clean_ref,
                                    correction_cn=f"发音有误，应为 '{clean_ref}'"))

    for i in range(len(ref_words), len(rec_words)):
        words.append(WordScore(word=rec_words[i], accuracy_score=0, error_type="Insertion",
                                correction_cn="参考文本中没有此词"))

    completeness = (matched / len(ref_words) * 100) if ref_words else 0
    accuracy = completeness * 0.9
    fluency = completeness * 0.85
    overall = (accuracy + fluency + completeness + completeness * 0.8 + completeness * 0.7 + completeness * 0.85) / 6

    return PronunciationResult(
        accuracy_score=round(accuracy, 1),
        fluency_score=round(fluency, 1),
        completeness_score=round(completeness, 1),
        overall_score=round(overall, 1),
        stress_score=round(completeness * 0.8, 1),
        intonation_score=round(completeness * 0.7, 1),
        rhythm_score=round(completeness * 0.85, 1),
        words=words,
        summary_en="Basic analysis (LLM unavailable). Please try again later.",
        summary_cn="基础分析（LLM 不可用），请稍后重试。",
    )


def _call_llm(prompt: str, max_tokens: int = 1500) -> str:
    """Call LLM API with fallback: DeepSeek → OpenAI."""
    from config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
    if DEEPSEEK_API_KEY and not DEEPSEEK_API_KEY.startswith("sk-your-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens, temperature=0.2,
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
            max_tokens=max_tokens, temperature=0.2,
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
