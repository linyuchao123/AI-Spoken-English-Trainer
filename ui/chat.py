"""
Chat interface component for displaying conversation history
with styled chat bubbles.
"""

import streamlit as st
from typing import Optional


def render_chat_area():
    """Render the main chat area with message history."""

    # ============================================================
    # Chat Header
    # ============================================================
    st.markdown("""
    <div style="text-align: center; padding: 0 0 20px 0;">
        <h2 style="color: #2d3436; margin: 0; font-weight: 600;">
            English Conversation Practice
        </h2>
    </div>
    """, unsafe_allow_html=True)

    # ============================================================
    # Message List
    # ============================================================
    if not st.session_state.messages:
        _render_empty_state()
    else:
        _render_messages()


def _render_empty_state():
    """Render the empty state when no messages exist."""
    st.markdown("""
    <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    ">
        <div style="font-size: 64px; margin-bottom: 20px;">
            🎤
        </div>
        <h3 style="color: #636e72; margin-bottom: 12px;">
            Ready to Practice?
        </h3>
        <p style="color: #b2bec3; font-size: 15px; max-width: 400px; line-height: 1.6;">
            Select a scene and difficulty from the sidebar,<br>
            then click <strong>「New Session」</strong> to start your English speaking practice.
        </p>
        <div style="
            margin-top: 30px;
            padding: 16px 24px;
            background: #f8f9fa;
            border-radius: 12px;
            font-size: 14px;
            color: #636e72;
            text-align: left;
            max-width: 450px;
        ">
            <strong>How it works:</strong><br>
            1. Click the microphone button to start speaking<br>
            2. Speak in English naturally<br>
            3. AI will reply and give you feedback<br>
            4. End the session for a detailed report
        </div>
    </div>
    """, unsafe_allow_html=True)


def _render_messages():
    """Render all chat messages as styled bubbles."""
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            _render_user_bubble(msg["content"])
        elif msg["role"] == "ai":
            _render_ai_bubble(msg["content"])

    # Auto-scroll placeholder
    st.markdown('<div id="chat-bottom"></div>', unsafe_allow_html=True)


def _render_user_bubble(content: str):
    """Render a user message bubble."""
    st.markdown(f"""
    <div class="chat-bubble user">
        <div class="bubble-content">
            <div class="bubble-role">You</div>
            {content}
        </div>
    </div>
    """, unsafe_allow_html=True)


def _render_ai_bubble(content: str):
    """Render an AI message bubble."""
    st.markdown(f"""
    <div class="chat-bubble ai">
        <div class="bubble-content">
            <div class="bubble-role">AI Partner</div>
            {content}
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_score_card(
    overall_score: float,
    accuracy_score: float = 0.0,
    fluency_score: float = 0.0,
    completeness_score: float = 0.0,
    error_words: Optional[list] = None,
):
    """Render a pronunciation score card after a user message.

    Args:
        overall_score: Overall pronunciation score (0-100)
        accuracy_score: Pronunciation accuracy score
        fluency_score: Fluency score
        completeness_score: Completeness score
        error_words: List of {word, correct_phoneme} dicts for mispronounced words
    """
    # Determine score color class
    if overall_score >= 80:
        score_class = "score-excellent"
        score_label = "Excellent"
    elif overall_score >= 60:
        score_class = "score-good"
        score_label = "Good"
    else:
        score_class = "score-needs-work"
        score_label = "Needs Work"

    # Build score bars HTML
    bars_html = ""
    for label, value, color in [
        ("Accuracy", accuracy_score, "#00b894"),
        ("Fluency", fluency_score, "#0984e3"),
        ("Completeness", completeness_score, "#6c5ce7"),
    ]:
        bars_html += f"""
        <div class="score-detail-item">
            <span>{label}</span>
            <span>{value:.0f}%</span>
        </div>
        <div class="score-detail-bar">
            <div class="score-detail-fill" style="width: {value:.0f}%; background: {color};"></div>
        </div>
        """

    # Build error words HTML
    error_html = ""
    if error_words:
        error_items = ""
        for ew in error_words[:5]:  # Show max 5
            word = ew.get("word", "")
            phoneme = ew.get("correct_phoneme", "")
            error_items += f'<span style="background:#ffeaa7; padding:2px 6px; border-radius:4px; margin:2px; display:inline-block;">{word} → [{phoneme}]</span> '
        error_html = f"""
        <div style="margin-top: 10px; font-size: 13px;">
            <strong style="color:#d63031;">Pronunciation errors:</strong><br>
            {error_items}
        </div>
        """

    st.markdown(f"""
    <div class="score-container">
        <div class="score-circle {score_class}">{overall_score:.0f}</div>
        <div class="score-details">
            <strong style="font-size: 16px; color: #2d3436;">Pronunciation Score — {score_label}</strong>
            {bars_html}
            {error_html}
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_correction_card(
    original: str,
    corrected: str,
    errors: Optional[list] = None,
):
    """Render a grammar correction card.

    Args:
        original: The original user sentence
        corrected: The corrected sentence
        errors: List of {type, original_text, corrected_text, explanation} dicts
    """
    errors_html = ""
    if errors:
        for err in errors:
            error_type = err.get("type", "")
            orig = err.get("original_text", "")
            corr = err.get("corrected_text", "")
            expl = err.get("explanation", "")
            errors_html += f"""
            <div style="margin-top: 8px; padding: 8px 12px; background: #fff; border-radius: 6px;">
                <span style="background: #e17055; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">{error_type}</span>
                <span style="color: #d63031; text-decoration: line-through; margin-left: 8px;">{orig}</span>
                <span style="color: #636e72;"> → </span>
                <span style="color: #00b894; font-weight: 600;">{corr}</span>
                <div style="color: #636e72; font-size: 12px; margin-top: 4px;">{expl}</div>
            </div>
            """

    st.markdown(f"""
    <div class="correction-card">
        <strong style="color: #f39c12;">Grammar & Expression Feedback</strong>
        <div class="correction-original">{original}</div>
        <div class="correction-fixed">{corrected}</div>
        {errors_html}
    </div>
    """, unsafe_allow_html=True)
