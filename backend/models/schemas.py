"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


# ============================================================
# Auth Schemas
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str = ""


class AuthResponse(BaseModel):
    user: UserResponse
    message: str = "Success"


# ============================================================
# Scene Schemas
# ============================================================

class SceneResponse(BaseModel):
    key: str
    name: str
    icon: str
    description: str


class DifficultyResponse(BaseModel):
    key: str
    name: str
    color: str


class ModelResponse(BaseModel):
    key: str
    name: str
    icon: str
    description: str


class ScenesConfigResponse(BaseModel):
    scenes: list[SceneResponse]
    difficulties: list[DifficultyResponse]
    models: list[ModelResponse]


# ============================================================
# Session Schemas
# ============================================================

class CreateSessionRequest(BaseModel):
    scene_key: str
    difficulty: str
    model: str = "openai"
    training_mode: str = "immersive"  # "immersive" or "realtime"


class SessionResponse(BaseModel):
    id: int
    scene_key: str
    scene_name: str
    difficulty: str
    model: str
    training_mode: str = "immersive"  # "immersive" or "realtime"
    status: str
    total_rounds: int = 0
    avg_pronunciation_score: float = 0.0
    created_at: Optional[str] = None
    ended_at: Optional[str] = None


# ============================================================
# Message Schemas
# ============================================================

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)
    audio_base64: str = Field(default="", description="Optional: base64-encoded audio for Chivox pronunciation assessment")


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: Optional[str] = None


# ============================================================
# Grammar Schemas
# ============================================================

class GrammarRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    model: str = "gpt-4o"


class GrammarError(BaseModel):
    type: str
    original_text: str
    corrected_text: str
    explanation: str
    explanation_cn: str = ""
    better_expression: str = ""


class ExpressionImprovement(BaseModel):
    original_phrase: str
    improved_phrase: str
    explanation: str
    explanation_cn: str = ""


class GrammarResponse(BaseModel):
    has_errors: bool
    original: str
    corrected: str
    errors: list[GrammarError]
    expression_improvements: list[ExpressionImprovement] = []


# ============================================================
# TTS Schemas
# ============================================================

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str = "default"
    provider: str = "edge"  # "edge", "azure", or "openai"
    rate: float = 1.0  # 0.5~2.0, only supported by Edge TTS


class TTSVoice(BaseModel):
    key: str
    name: str
    gender: str = "varied"


class TTSVoicesResponse(BaseModel):
    voices: dict[str, list[TTSVoice]]


class TTSResponse(BaseModel):
    audio_base64: str
    format: str = "mp3"
    voice: str
    provider: str


# ============================================================
# Pronunciation Assessment Schemas
# ============================================================

class WordScoreResponse(BaseModel):
    word: str
    accuracy_score: float
    error_type: str  # "None", "Omission", "Insertion", "Mispronunciation"
    expected_pronunciation: str = ""
    correction_cn: str = ""


class PronunciationResponse(BaseModel):
    accuracy_score: float = 0
    fluency_score: float = 0
    completeness_score: float = 0
    overall_score: float = 0
    # Extended scores
    stress_score: float = 0
    intonation_score: float = 0
    rhythm_score: float = 0
    # Word detail
    words: list[WordScoreResponse] = []
    # Phoneme highlights
    phoneme_highlights: list[str] = []
    # Summary
    summary_en: str = ""
    summary_cn: str = ""
    suggestions: list[str] = []
    error: str = ""


# ============================================================
# Report Schemas
# ============================================================

class ScorePoint(BaseModel):
    round: int
    score: float


class SentenceAnalysisItem(BaseModel):
    message_index: int
    original_en: str = ""
    translation_cn: str = ""
    pronunciation_issues: list[str] = []
    grammar_issues: list[str] = []
    expression_improvements: list[str] = []


class ScoreBreakdown(BaseModel):
    grammar_score: float = 0
    vocabulary_score: float = 0
    fluency_score: float = 0
    expression_score: float = 0
    naturalness_score: float = 0
    emotion_score: float = 0


class ReportResponse(BaseModel):
    session_id: int
    scene_name: str
    difficulty: str
    model: str
    total_rounds: int
    avg_pronunciation_score: float
    created_at: str = ""
    ended_at: str = ""
    message_count: int = 0
    score_count: int = 0
    correction_count: int = 0
    error_stats: dict[str, int] = {}
    score_history: list[ScorePoint] = []
    score_breakdown: Optional[ScoreBreakdown] = None
    # LLM analysis
    summary: str = ""
    summary_cn: str = ""
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    topics_covered: list[str] = []
    level_assessment: str = ""
    level_assessment_cn: str = ""
    # Per-sentence analysis
    sentence_analyses: list[SentenceAnalysisItem] = []


# ============================================================
# Session Detail Schemas (for history review)
# ============================================================

class DetailPronunciation(BaseModel):
    overall_score: float = 0
    accuracy_score: float = 0
    fluency_score: float = 0
    completeness_score: float = 0
    words: list[WordScoreResponse] = []


class DetailGrammar(BaseModel):
    original_text: str
    corrected_text: str
    error_type: str = ""
    explanation: str = ""
    explanation_cn: str = ""
    better_expression: str = ""  # improved expression suggestion


class DetailMessage(BaseModel):
    id: int
    role: str
    content: str
    translation_cn: str = ""
    pronunciation: Optional[DetailPronunciation] = None
    grammar: Optional[DetailGrammar] = None


class SessionDetailResponse(BaseModel):
    session_id: int
    scene_name: str
    scene_key: str
    difficulty: str
    model: str
    status: str
    total_rounds: int
    avg_pronunciation_score: float
    created_at: str = ""
    ended_at: str = ""
    messages: list[DetailMessage] = []
    evaluation: Optional["EvaluationResponse"] = None


# ============================================================
# Evaluation Schemas
# ============================================================

class EvaluationResponse(BaseModel):
    overall_score: float = 0
    grammar_score: float = 0
    vocabulary_score: float = 0
    fluency_score: float = 0
    expression_score: float = 0
    naturalness_score: float = 0
    emotion_score: float = 0
    summary: str = ""
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []


# ============================================================
# Real-time Feedback Schemas (per-message analysis)
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


class RealtimeFeedbackResponse(BaseModel):
    """Real-time per-message feedback returned alongside the AI reply."""
    has_errors: bool = False
    overall_score: float = Field(ge=0, le=100, default=75,
                                  description="Overall score for this sentence (0-100)")
    corrected_sentence: str = Field(default="",
                                     description="Fully corrected version of the user sentence")
    grammar_errors: list[RealtimeGrammarError] = Field(default_factory=list)
    expression_suggestions: list[RealtimeExpressionSuggestion] = Field(default_factory=list)
    summary_cn: str = Field(default="", description="One-sentence Chinese summary of feedback")


class SendMessageResponse(BaseModel):
    """Wrapper for send_message that may include real-time feedback."""
    messages: list[MessageResponse]
    feedback: Optional[RealtimeFeedbackResponse] = None
    pronunciation: Optional[PronunciationResponse] = None
