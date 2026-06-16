"""
LangGraph Real-time Feedback Workflow.

A lightweight single-node agent that runs IMMEDIATELY after each user message
in "realtime" training mode.  It analyses a single sentence for grammar errors,
expression improvements, and assigns an overall score.

Pipeline:
    START → realtime_analyst → END

Unlike the 4-node evaluation pipeline (which runs once at session end), this
workflow is designed for per-message, low-latency feedback.

All nodes are automatically traced by LangSmith when LANGCHAIN_TRACING_V2=true.
"""

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

load_dotenv()

from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, Field

from modules.agents.llm_factory import get_fallback_model

logger = logging.getLogger(__name__)


# ============================================================
# Pydantic Output Schema
# ============================================================


class RealtimeGrammarError(BaseModel):
    """A single grammar/vocabulary error found in real-time."""
    original_text: str = Field(description="The incorrect word or phrase")
    corrected_text: str = Field(description="The corrected version")
    error_type: str = Field(default="", description="e.g. tense, article, preposition")
    explanation: str = Field(default="", description="English explanation")
    explanation_cn: str = Field(default="", description="Chinese explanation")


class RealtimeExpressionSuggestion(BaseModel):
    """A better/more natural way to express an idea."""
    original_phrase: str = ""
    improved_phrase: str = ""
    explanation: str = ""
    explanation_cn: str = ""


class RealtimeFeedbackOutput(BaseModel):
    """Structured output from the realtime_analyst node."""
    has_errors: bool = Field(description="Whether any errors were found")
    overall_score: float = Field(ge=0, le=100, description="Overall score for this sentence (0-100)")
    corrected_sentence: str = Field(default="", description="Fully corrected version of the user sentence")
    grammar_errors: list[RealtimeGrammarError] = Field(default_factory=list)
    expression_suggestions: list[RealtimeExpressionSuggestion] = Field(default_factory=list)
    summary_cn: str = Field(default="", description="One-sentence Chinese summary of feedback")


# ============================================================
# LangGraph State
# ============================================================


class RealtimeFeedbackState(BaseModel):
    """State for the real-time feedback workflow."""
    user_message: str = ""
    difficulty: str = "intermediate"
    feedback: dict | None = None
    error: str = ""

    class Config:
        arbitrary_types_allowed = True


# ============================================================
# Agent Node Function
# ============================================================


def realtime_analyst_node(state: RealtimeFeedbackState) -> dict:
    """
    Analyse a single user message for grammar errors, expression improvements,
    and assign an overall score.

    Writes: state["feedback"]
    """
    user_message = state.user_message
    difficulty = state.difficulty

    if not user_message or not user_message.strip():
        return {
            "feedback": RealtimeFeedbackOutput(
                has_errors=False,
                overall_score=100,
                summary_cn="没有检测到用户输入。",
            ).model_dump()
        }

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are an expert English coach providing instant, real-time feedback "
            "to an L2 English learner at {difficulty} level.\n\n"
            "Your task:\n"
            "1. Check the student's sentence for grammar errors, vocabulary misuse, "
            "   and awkward phrasing.\n"
            "2. For each error found, provide the incorrect text, corrected text, "
            "   error type, and bilingual explanations.\n"
            "3. Suggest more natural expressions even if grammatically correct.\n"
            "4. Assign an overall score (0-100) for this sentence.\n"
            "   - 90-100: Excellent / Near-native\n"
            "   - 75-89:  Good / Minor issues\n"
            "   - 60-74:  Fair / Some errors\n"
            "   - 40-59:  Basic / Struggles\n"
            "   - 0-39:   Beginner\n"
            "5. Provide the fully corrected sentence.\n"
            "6. Write a one-sentence Chinese summary.\n\n"
            "Be concise and encouraging — this is real-time feedback, not a full report."
        )),
        ("human", "Analyse this sentence: \"{user_message}\"\n\n"
                   "Return a structured analysis with errors, suggestions, score, "
                   "corrected sentence, and a Chinese summary."),
    ])

    llm = get_fallback_model(temperature=0.2, max_tokens=1000)
    structured_llm = llm.with_structured_output(
        RealtimeFeedbackOutput, method="function_calling"
    )

    chain = prompt | structured_llm
    result: RealtimeFeedbackOutput = chain.invoke({
        "difficulty": difficulty,
        "user_message": user_message,
    })

    logger.info(
        "[realtime_analyst] score=%.0f, has_errors=%s, grammar_errors=%d, suggestions=%d",
        result.overall_score, result.has_errors,
        len(result.grammar_errors), len(result.expression_suggestions),
    )
    return {"feedback": result.model_dump()}


# ============================================================
# Graph Construction
# ============================================================


def _build_graph() -> StateGraph:
    """Build and compile the real-time feedback StateGraph."""
    graph = StateGraph(RealtimeFeedbackState)

    graph.add_node("realtime_analyst", realtime_analyst_node)
    graph.add_edge(START, "realtime_analyst")
    graph.add_edge("realtime_analyst", END)

    return graph.compile()


# Module-level compiled graph
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


def run_realtime_feedback(
    user_message: str,
    difficulty: str = "intermediate",
) -> RealtimeFeedbackOutput:
    """
    Run the real-time feedback analysis on a single user message.

    Args:
        user_message: The student's sentence to analyse.
        difficulty: The session difficulty level.

    Returns:
        RealtimeFeedbackOutput with grammar errors, expression suggestions,
        overall score, corrected sentence, and Chinese summary.

    Raises:
        RuntimeError: If no LLM API key is configured.
    """
    from modules.agents.llm_factory import any_llm_available

    if not any_llm_available():
        raise RuntimeError("No LLM API key configured (OPENAI_API_KEY or DEEPSEEK_API_KEY).")

    initial_state = RealtimeFeedbackState(
        user_message=user_message,
        difficulty=difficulty,
    )

    graph = _get_graph()

    try:
        final_state = graph.invoke(initial_state)
        # final_state may be a dict or a Pydantic model depending on LangGraph version
        if hasattr(final_state, "feedback"):
            feedback_dict = final_state.feedback or {}
        else:
            feedback_dict = final_state.get("feedback", {})
        result = RealtimeFeedbackOutput(**feedback_dict)
        logger.info(
            "[run_realtime_feedback] score=%.0f for: %s",
            result.overall_score, user_message[:50],
        )
        return result

    except Exception as exc:
        logger.error("[run_realtime_feedback] Failed: %s", exc)
        raise
