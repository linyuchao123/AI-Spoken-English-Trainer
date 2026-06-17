"""
LangGraph Evaluation Workflow.

Orchestrates a 4-node AI agent pipeline that runs AFTER a conversation session
ends.  During the conversation the AI speaks naturally without interrupting the
student; only after the session is closed does this workflow kick in.

Pipeline:
    [grammar_analyst]
         |
         v
    (conditional edge: skip if no pronunciation data)
         |
         v
    [pronunciation_analyst]
         |
         v
    [comprehensive_evaluator]
         |
         v
    [report_generator]

Each node is a LangChain agent that uses `with_structured_output()` to guarantee
well-typed JSON results.

All nodes are automatically traced by LangSmith when LANGCHAIN_TRACING_V2=true
is set in the environment.
"""

import logging
import os
import sys
from typing import TypedDict

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

load_dotenv()

from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, Field

from modules.agents.llm_factory import get_fallback_model

logger = logging.getLogger(__name__)


# ============================================================
# Pydantic Output Schemas (used with `with_structured_output`)
# ============================================================


class GrammarErrorItem(BaseModel):
    """A single grammar / vocabulary / expression error."""
    message_index: int = Field(description="0-based index of the student message")
    original_sentence: str = Field(description="The full original student sentence")
    error_type: str = Field(description="e.g. 'tense', 'article', 'preposition', 'vocabulary', 'word_order'")
    original_text: str = Field(description="The incorrect fragment")
    corrected_text: str = Field(description="The corrected fragment")
    explanation: str = Field(description="English explanation of the error")
    explanation_cn: str = Field(description="Chinese explanation of the error")


class ExpressionSuggestion(BaseModel):
    """A better way to express an idea (even if grammatically correct)."""
    message_index: int = Field(description="0-based index of the student message")
    original_phrase: str = Field(description="The original phrase")
    improved_phrase: str = Field(description="A more natural / native-like alternative")
    explanation: str = Field(description="Why the improved version is better")
    explanation_cn: str = Field(description="Chinese explanation")


class GrammarAnalysisOutput(BaseModel):
    """Structured output from the grammar_analyst node."""
    error_count: int = Field(description="Total number of errors found")
    errors: list[GrammarErrorItem] = Field(default_factory=list)
    expression_suggestions: list[ExpressionSuggestion] = Field(default_factory=list)
    overall_grammar_comment: str = Field(description="2-3 sentence overall grammar assessment in English")
    overall_grammar_comment_cn: str = Field(description="2-3句中文语法总体评价")
    grammar_score: float = Field(ge=0, le=100, description="0-100 grammar accuracy score")
    vocabulary_score: float = Field(ge=0, le=100, description="0-100 vocabulary richness score")


class PronunciationAnalysisOutput(BaseModel):
    """Structured output from the pronunciation_analyst node."""
    avg_accuracy: float = Field(ge=0, le=100, description="Average pronunciation accuracy")
    avg_fluency: float = Field(ge=0, le=100, description="Average fluency score")
    avg_completeness: float = Field(ge=0, le=100, description="Average completeness score")
    avg_stress: float = Field(ge=0, le=100, description="Average stress score")
    avg_intonation: float = Field(ge=0, le=100, description="Average intonation score")
    avg_rhythm: float = Field(ge=0, le=100, description="Average rhythm score")
    common_issues: list[str] = Field(default_factory=list, description="Top 3-5 recurring pronunciation issues")
    phoneme_highlights: list[str] = Field(default_factory=list, description="Phoneme-level feedback")
    overall_pronunciation_comment: str = Field(description="2-3 sentence overall assessment in English")
    overall_pronunciation_comment_cn: str = Field(description="2-3句中文发音总体评价")


class EvaluationScoresOutput(BaseModel):
    """Structured output from the comprehensive_evaluator node."""
    overall_score: float = Field(ge=0, le=100)
    grammar_score: float = Field(ge=0, le=100)
    vocabulary_score: float = Field(ge=0, le=100)
    fluency_score: float = Field(ge=0, le=100)
    expression_score: float = Field(ge=0, le=100)
    naturalness_score: float = Field(ge=0, le=100)
    emotion_score: float = Field(ge=0, le=100)
    summary: str = Field(description="2-3 sentence overall assessment in English")
    summary_cn: str = Field(description="2-3句中文总体评价")
    strengths: list[str] = Field(min_length=2, description="At least 2 strengths (each item: 'English description / 中文说明' bilingual format)")
    weaknesses: list[str] = Field(min_length=2, description="At least 2 weaknesses with examples (bilingual: English + 中文)")
    suggestions: list[str] = Field(min_length=3, description="At least 3 actionable suggestions (bilingual: English + 中文)")


class SentenceAnalysisItem(BaseModel):
    """Per-sentence bilingual analysis for the learning report."""
    message_index: int = Field(description="0-based index of student message")
    original_en: str = Field(description="The exact student sentence")
    translation_cn: str = Field(description="Chinese translation of the sentence")
    pronunciation_issues: list[str] = Field(default_factory=list)
    grammar_issues: list[str] = Field(default_factory=list)
    expression_improvements: list[str] = Field(default_factory=list)


class ReportOutput(BaseModel):
    """Structured output from the report_generator node."""
    level_assessment: str = Field(description="e.g. 'Intermediate — good vocabulary, needs sentence structure work'")
    level_assessment_cn: str = Field(description="e.g. '中级水平 — 词汇量不错，需要加强句型结构'")
    topics_covered: list[str] = Field(default_factory=list)
    sentence_analyses: list[SentenceAnalysisItem] = Field(default_factory=list)


# ============================================================
# LangGraph State
# ============================================================


class EvaluationState(TypedDict, total=False):
    """State passed through the LangGraph evaluation workflow."""

    # ── Inputs (set before workflow starts) ─────────────────────────
    messages: list  # Conversation messages [{role, content, id?}, ...]
    session_info: dict  # {scene_name, difficulty, model, total_rounds}
    pronunciation_scores: list  # Per-message pronunciation score dicts (may be empty)

    # ── Intermediate outputs (written by agent nodes) ────────────────
    grammar_analysis: dict  # GrammarAnalysisOutput.model_dump()
    pronunciation_analysis: dict  # PronunciationAnalysisOutput.model_dump()
    evaluation_scores: dict  # EvaluationScoresOutput.model_dump()
    report: dict  # ReportOutput.model_dump()

    # ── Errors collected during execution ─────────────────────────────
    errors: list  # List of error strings (non-fatal)


# ============================================================
# Agent Node Functions
# ============================================================


def _get_student_messages(messages: list[dict]) -> list[tuple[int, str]]:
    """Return (index, content) pairs for student (user) messages."""
    return [
        (i, m["content"])
        for i, m in enumerate(messages)
        if m.get("role") == "user"
    ]


def _build_transcript(messages: list[dict], max_per_msg: int = 400) -> str:
    """Build a readable transcript string from messages."""
    lines = []
    for m in messages:
        role = "Student" if m.get("role") == "user" else "Teacher"
        lines.append(f"[{role}]: {m['content'][:max_per_msg]}")
    return "\n".join(lines)


# ── Node 1: Grammar Analyst ──────────────────────────────────────────────────


def grammar_analyst_node(state: EvaluationState) -> dict:
    """
    Analyse every student message for grammar errors, vocabulary issues,
    and expression improvements.

    Writes: state["grammar_analysis"]
    """
    messages = state.get("messages", [])
    session_info = state.get("session_info", {})
    student_msgs = _get_student_messages(messages)

    if not student_msgs:
        return {
            "grammar_analysis": GrammarAnalysisOutput(
                error_count=0,
                overall_grammar_comment="No student speech to analyse.",
                overall_grammar_comment_cn="没有学生发言可供分析。",
                grammar_score=50.0,
                vocabulary_score=50.0,
            ).model_dump()
        }

    # Build numbered student sentences for the LLM
    numbered = "\n".join(
        f"[{idx}]: {text}" for idx, text in student_msgs
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are an expert English grammar coach specialising in L2 learner analysis.\n"
            "Analyse the following student sentences from a {difficulty}-level "
            "{scene_name} conversation practice session.\n\n"
            "For EACH sentence, identify grammar errors, vocabulary misuse, "
            "and suggest more natural expressions even if the sentence is correct.\n"
            "Be constructive and specific. Provide bilingual explanations."
        )),
        ("human", "## Student Sentences\n{numbered}\n\n"
                   "Return a structured analysis with all errors, expression suggestions, "
                   "an overall grammar comment (English + Chinese), and scores (0-100)."),
    ])

    llm = get_fallback_model(temperature=0.2, max_tokens=3000)
    structured_llm = llm.with_structured_output(GrammarAnalysisOutput, method="function_calling")

    chain = prompt | structured_llm
    result: GrammarAnalysisOutput = chain.invoke({
        "difficulty": session_info.get("difficulty", "intermediate"),
        "scene_name": session_info.get("scene_name", "conversation"),
        "numbered": numbered,
    })

    logger.info(
        "[grammar_analyst] Found %d errors, grammar_score=%.0f, vocab_score=%.0f",
        result.error_count, result.grammar_score, result.vocabulary_score,
    )
    return {"grammar_analysis": result.model_dump()}


# ── Node 2: Pronunciation Analyst ─────────────────────────────────────────────


def pronunciation_analyst_node(state: EvaluationState) -> dict:
    """
    Aggregate pronunciation scores collected during the conversation and
    produce a unified pronunciation assessment.

    Writes: state["pronunciation_analysis"]
    """
    scores = state.get("pronunciation_scores", [])
    messages = state.get("messages", [])
    session_info = state.get("session_info", {})

    if not scores:
        # No pronunciation data — return neutral placeholder
        return {
            "pronunciation_analysis": PronunciationAnalysisOutput(
                avg_accuracy=0, avg_fluency=0, avg_completeness=0,
                avg_stress=0, avg_intonation=0, avg_rhythm=0,
                common_issues=["No pronunciation data collected during this session."],
                overall_pronunciation_comment="Pronunciation was not assessed during this session.",
                overall_pronunciation_comment_cn="本次会话未进行发音评估。",
            ).model_dump()
        }

    # Build a summary of score averages for the LLM context
    dims = ["accuracy_score", "fluency_score", "completeness_score",
            "stress_score", "intonation_score", "rhythm_score", "overall_score"]
    avg_summary = {}
    for dim in dims:
        vals = [s.get(dim, 0) for s in scores if s.get(dim) is not None]
        avg_summary[dim] = round(sum(vals) / len(vals), 1) if vals else 0.0

    # Build per-message score lines for context
    student_msgs = _get_student_messages(messages)
    per_msg_lines = []
    for i, (msg_idx, text) in enumerate(student_msgs):
        if i < len(scores):
            s = scores[i]
            per_msg_lines.append(
                f"[{msg_idx}] \"{text[:120]}\" — "
                f"accuracy={s.get('accuracy_score',0)}, "
                f"fluency={s.get('fluency_score',0)}, "
                f"completeness={s.get('completeness_score',0)}"
            )

    # Also include word-level error details if present
    word_details = []
    for s in scores:
        words = s.get("words", [])
        for w in words:
            if w.get("error_type", "None") != "None":
                word_details.append(
                    f"  '{w.get('word','')}' — {w.get('error_type','')} "
                    f"(accuracy={w.get('accuracy_score',0)})"
                )

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a professional English pronunciation coach.\n"
            "You are given aggregated pronunciation assessment scores from a "
            "{difficulty}-level {scene_name} conversation session.\n\n"
            "Summarise the student's pronunciation performance across all "
            "dimensions (accuracy, fluency, completeness, stress, intonation, rhythm).\n"
            "Identify the top recurring issues and provide bilingual feedback."
        )),
        ("human",
         "## Average Scores\n{avg_summary}\n\n"
         "## Per-Message Scores\n{per_msg_lines}\n\n"
         "## Word-Level Error Details\n{word_details}\n\n"
         "Provide a structured pronunciation analysis."),
    ])

    llm = get_fallback_model(temperature=0.2, max_tokens=2000)
    structured_llm = llm.with_structured_output(PronunciationAnalysisOutput, method="function_calling")

    chain = prompt | structured_llm
    result: PronunciationAnalysisOutput = chain.invoke({
        "difficulty": session_info.get("difficulty", "intermediate"),
        "scene_name": session_info.get("scene_name", "conversation"),
        "avg_summary": str(avg_summary),
        "per_msg_lines": "\n".join(per_msg_lines[:20]) or "N/A",
        "word_details": "\n".join(word_details[:30]) or "No word-level errors.",
    })

    logger.info(
        "[pronunciation_analyst] avg_accuracy=%.0f, avg_fluency=%.0f",
        result.avg_accuracy, result.avg_fluency,
    )
    return {"pronunciation_analysis": result.model_dump()}


# ── Node 3: Comprehensive Evaluator ───────────────────────────────────────────


def comprehensive_evaluator_node(state: EvaluationState) -> dict:
    """
    Produce the final multi-dimension scores and qualitative feedback by
    synthesising the grammar and pronunciation analyses together with the
    full conversation transcript.

    Writes: state["evaluation_scores"]
    """
    messages = state.get("messages", [])
    session_info = state.get("session_info", {})
    grammar = state.get("grammar_analysis", {})
    pronunciation = state.get("pronunciation_analysis", {})

    transcript = _build_transcript(messages)

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a senior English speaking examiner evaluating a student's "
            "conversation performance in a {difficulty}-level {scene_name} session.\n\n"
            "You have access to:\n"
            "- The full conversation transcript\n"
            "- A grammar analysis (errors, vocabulary score)\n"
            "- A pronunciation analysis (accuracy, fluency, stress, intonation)\n\n"
            "Synthesise all information into fair, constructive 7-dimension scores "
            "(0-100) and qualitative feedback.\n"
            "Scoring guide:\n"
            "  90-100: Excellent / Near-native\n"
            "  75-89:  Good / Confident\n"
            "  60-74:  Fair / Some errors\n"
            "  40-59:  Basic / Struggles\n"
            "  0-39:   Beginner"
        )),
        ("human",
         "## Conversation Transcript\n{transcript}\n\n"
         "## Grammar Analysis\n"
         "  grammar_score={grammar_score}, vocabulary_score={vocabulary_score}\n"
         "  error_count={error_count}\n"
         "  comment: {grammar_comment}\n\n"
         "## Pronunciation Analysis\n"
         "  avg_accuracy={p_accuracy}, avg_fluency={p_fluency}\n"
         "  avg_completeness={p_completeness}, avg_stress={p_stress}\n"
         "  avg_intonation={p_intonation}, avg_rhythm={p_rhythm}\n"
         "  comment: {pronunciation_comment}\n\n"
         "Produce 7-dimension scores, a bilingual summary, bilingual strengths, bilingual weaknesses "
         "(with concrete examples from the conversation), "
         "and at least 3 bilingual actionable suggestions. "
         "Each strength/weakness/suggestion item must include both English and 中文 (Chinese) annotations."),
    ])

    llm = get_fallback_model(temperature=0.3, max_tokens=2000)
    structured_llm = llm.with_structured_output(EvaluationScoresOutput, method="function_calling")

    chain = prompt | structured_llm
    result: EvaluationScoresOutput = chain.invoke({
        "difficulty": session_info.get("difficulty", "intermediate"),
        "scene_name": session_info.get("scene_name", "conversation"),
        "transcript": transcript[:4000],
        "grammar_score": grammar.get("grammar_score", 50),
        "vocabulary_score": grammar.get("vocabulary_score", 50),
        "error_count": grammar.get("error_count", 0),
        "grammar_comment": grammar.get("overall_grammar_comment", ""),
        "p_accuracy": pronunciation.get("avg_accuracy", 0),
        "p_fluency": pronunciation.get("avg_fluency", 0),
        "p_completeness": pronunciation.get("avg_completeness", 0),
        "p_stress": pronunciation.get("avg_stress", 0),
        "p_intonation": pronunciation.get("avg_intonation", 0),
        "p_rhythm": pronunciation.get("avg_rhythm", 0),
        "pronunciation_comment": pronunciation.get("overall_pronunciation_comment", "N/A"),
    })

    logger.info(
        "[comprehensive_evaluator] overall=%.0f, grammar=%.0f, fluency=%.0f",
        result.overall_score, result.grammar_score, result.fluency_score,
    )
    return {"evaluation_scores": result.model_dump()}


# ── Node 4: Report Generator ──────────────────────────────────────────────────


def report_generator_node(state: EvaluationState) -> dict:
    """
    Produce a detailed bilingual learning report with per-sentence analysis,
    level assessment, and topics covered.

    Writes: state["report"]
    """
    messages = state.get("messages", [])
    session_info = state.get("session_info", {})
    grammar = state.get("grammar_analysis", {})
    pronunciation = state.get("pronunciation_analysis", {})
    eval_scores = state.get("evaluation_scores", {})

    student_msgs = _get_student_messages(messages)
    numbered = "\n".join(f"[{idx}]: {text}" for idx, text in student_msgs)
    transcript = _build_transcript(messages)

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a professional bilingual (English + Chinese) English learning "
            "report writer.\n\n"
            "Based on the conversation transcript, grammar analysis, pronunciation "
            "analysis, and evaluation scores below, produce a comprehensive learning "
            "report.\n\n"
            "For EVERY student sentence, provide:\n"
            "- Chinese translation\n"
            "- Pronunciation issues (if any)\n"
            "- Grammar issues (if any)\n"
            "- Expression improvements (more natural alternatives)\n\n"
            "Also determine the student's level and list topics discussed."
        )),
        ("human",
         "## Session: {scene_name} ({difficulty}), {total_rounds} rounds\n\n"
         "## Conversation Transcript\n{transcript}\n\n"
         "## Student Sentences (numbered)\n{numbered}\n\n"
         "## Evaluation Scores\n"
         "  overall={overall}, grammar={grammar}, vocabulary={vocabulary}\n"
         "  fluency={fluency}, expression={expression}\n"
         "  naturalness={naturalness}, emotion={emotion}\n\n"
         "## Grammar Analysis Summary\n{grammar_summary}\n\n"
         "## Pronunciation Analysis Summary\n{pronunciation_summary}\n\n"
         "Produce the full learning report."),
    ])

    llm = get_fallback_model(temperature=0.3, max_tokens=4000)
    structured_llm = llm.with_structured_output(ReportOutput, method="function_calling")

    chain = prompt | structured_llm
    result: ReportOutput = chain.invoke({
        "scene_name": session_info.get("scene_name", "conversation"),
        "difficulty": session_info.get("difficulty", "intermediate"),
        "total_rounds": session_info.get("total_rounds", 0),
        "transcript": transcript[:3000],
        "numbered": numbered[:3000],
        "overall": eval_scores.get("overall_score", 0),
        "grammar": eval_scores.get("grammar_score", 0),
        "vocabulary": eval_scores.get("vocabulary_score", 0),
        "fluency": eval_scores.get("fluency_score", 0),
        "expression": eval_scores.get("expression_score", 0),
        "naturalness": eval_scores.get("naturalness_score", 0),
        "emotion": eval_scores.get("emotion_score", 0),
        "grammar_summary": grammar.get("overall_grammar_comment", "N/A"),
        "pronunciation_summary": pronunciation.get("overall_pronunciation_comment", "N/A"),
    })

    logger.info(
        "[report_generator] %d sentence analyses, level=%s",
        len(result.sentence_analyses), result.level_assessment[:40],
    )
    return {"report": result.model_dump()}


# ============================================================
# Conditional Edge Functions
# ============================================================


def should_skip_pronunciation(state: EvaluationState) -> str:
    """
    Decide whether to skip the pronunciation_analyst node.

    Returns:
        "skip" — jump straight to comprehensive_evaluator
        "analyse" — run pronunciation_analyst
    """
    scores = state.get("pronunciation_scores", [])
    if not scores:
        logger.info("[router] No pronunciation data — skipping pronunciation_analyst.")
        return "skip"
    return "analyse"


# ============================================================
# Graph Construction
# ============================================================


def _build_graph() -> StateGraph:
    """Build and compile the evaluation StateGraph."""

    graph = StateGraph(EvaluationState)

    # Register nodes
    graph.add_node("grammar_analyst", grammar_analyst_node)
    graph.add_node("pronunciation_analyst", pronunciation_analyst_node)
    graph.add_node("comprehensive_evaluator", comprehensive_evaluator_node)
    graph.add_node("report_generator", report_generator_node)

    # Entry point
    graph.add_edge(START, "grammar_analyst")

    # Conditional edge after grammar_analyst
    graph.add_conditional_edges(
        "grammar_analyst",
        should_skip_pronunciation,
        {
            "analyse": "pronunciation_analyst",
            "skip": "comprehensive_evaluator",
        },
    )

    # Linear edges for the rest
    graph.add_edge("pronunciation_analyst", "comprehensive_evaluator")
    graph.add_edge("comprehensive_evaluator", "report_generator")
    graph.add_edge("report_generator", END)

    return graph.compile()


# Module-level compiled graph (built once at import time)
_compiled_graph = None


def _get_graph():
    """Lazily build the graph to avoid import-time overhead."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


# ============================================================
# Public Entry Point
# ============================================================


def run_evaluation_pipeline(
    messages: list[dict],
    session_info: dict,
    pronunciation_scores: list | None = None,
) -> EvaluationState:
    """
    Run the full LangGraph evaluation pipeline.

    This is the single public entry point called by the backend API when a
    session ends.  It replaces the old synchronous `evaluate_session()` and
    `generate_report()` calls.

    Args:
        messages:
            Conversation messages as a list of dicts:
            [{"role": "user"|"ai", "content": "...", "id": N?}, ...]
        session_info:
            Session metadata:
            {"scene_name": "...", "difficulty": "...", "model": "...", "total_rounds": N}
        pronunciation_scores:
            Optional list of per-message pronunciation score dicts collected
            during the conversation.  May be empty if pronunciation was not assessed.

    Returns:
        The final EvaluationState dict containing:
        - evaluation_scores: 7-dimension scores + qualitative feedback
        - report: bilingual learning report with per-sentence analysis
        - grammar_analysis: detailed grammar analysis
        - pronunciation_analysis: pronunciation summary
        - errors: list of non-fatal errors (if any)

    Raises:
        RuntimeError: If no LLM API key is configured.
    """
    from modules.agents.llm_factory import any_llm_available

    if not any_llm_available():
        raise RuntimeError("No LLM API key configured (OPENAI_API_KEY or DEEPSEEK_API_KEY).")

    initial_state: EvaluationState = {
        "messages": messages,
        "session_info": session_info,
        "pronunciation_scores": pronunciation_scores or [],
        "errors": [],
    }

    graph = _get_graph()

    try:
        final_state = graph.invoke(initial_state)
        logger.info(
            "[run_evaluation_pipeline] Completed successfully. "
            "overall_score=%.0f",
            final_state.get("evaluation_scores", {}).get("overall_score", 0),
        )
        return final_state

    except Exception as exc:
        logger.error("[run_evaluation_pipeline] Pipeline failed: %s", exc)
        # Re-raise so the caller can fall back to the old synchronous path
        raise
