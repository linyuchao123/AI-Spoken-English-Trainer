"""
AI英语口语陪练 — Main Application Entry Point
===============================================
A Streamlit-based AI English speaking practice tool with:
- Scene selection (Job Interview / Restaurant / Business Meeting)
- 3 difficulty levels per scene
- Real-time voice conversation via microphone
- Pronunciation scoring (Azure Pronunciation Assessment)
- Grammar & expression correction
- Post-session quantitative learning report

Author: AI Spoken English Trainer
Version: 1.0.0
"""

import streamlit as st
import sys
import os

# Ensure the project root is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import APP_NAME, SCENES, DIFFICULTY_LEVELS
from ui.sidebar import render_sidebar
from ui.chat import render_chat_area, render_score_card, render_correction_card


# ============================================================
# Page Configuration
# ============================================================
st.set_page_config(
    page_title=APP_NAME,
    page_icon="🎤",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        "Get Help": None,
        "Report a bug": None,
        "About": f"**{APP_NAME}** — AI-powered English speaking practice tool. "
                 f"Practice real conversations with instant feedback.",
    },
)


# ============================================================
# Load Custom CSS
# ============================================================
def load_css():
    """Load custom CSS styles from assets/style.css."""
    css_path = os.path.join(os.path.dirname(__file__), "assets", "style.css")
    if os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)


# ============================================================
# Initialize Session State
# ============================================================
def init_session_state():
    """Ensure all required session state keys exist with defaults."""
    defaults = {
        "current_scene": "job_interview",
        "current_difficulty": "beginner",
        "current_model": "openai",
        "session_active": False,
        "session_id": None,
        "show_report": False,
        "messages": [],
        "pending_user_audio": None,
        "last_pronunciation_score": None,
        "last_correction_data": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


# ============================================================
# Main Application Layout
# ============================================================
def main():
    """Main application entry point."""
    load_css()
    init_session_state()

    # Render sidebar (scene selection, difficulty, model, sessions)
    render_sidebar()

    # ============================================================
    # Main Content Area
    # ============================================================
    if st.session_state.show_report and st.session_state.session_id:
        _render_report_page()
    else:
        _render_practice_page()


def _render_practice_page():
    """Render the practice page with chat interface and controls."""
    render_chat_area()

    # ============================================================
    # Bottom Control Bar — Placeholder for PR2
    # ============================================================
    st.divider()

    if st.session_state.session_active:
        # Control bar with recording button (placeholder)
        col1, col2, col3 = st.columns([2, 1, 2])

        with col2:
            st.markdown("""
            <div style="text-align: center;">
                <p style="color: #b2bec3; font-size: 14px; margin-bottom: 8px;">
                    Speak in English
                </p>
                <div class="record-button" style="margin: 0 auto;">
                    🎤
                </div>
                <p style="color: #b2bec3; font-size: 12px; margin-top: 8px;">
                    Recording feature coming in PR2
                </p>
            </div>
            """, unsafe_allow_html=True)

        # Text input as fallback for testing
        st.markdown("---")
        st.caption("**Text Input (for testing before voice is ready):**")
        user_text = st.chat_input("Type your English message here...")
        if user_text:
            _handle_text_input(user_text)
    else:
        st.info("Start a new session from the sidebar to begin practicing.")


def _handle_text_input(user_text: str):
    """Handle text input from the chat input box (fallback for testing)."""
    # Add user message
    st.session_state.messages.append({"role": "user", "content": user_text})

    # Placeholder AI response (will be replaced by actual LLM in PR2)
    ai_response = f"[AI Response Placeholder] You said: _{user_text}_. This will be replaced with actual LLM conversation in PR2."

    st.session_state.messages.append({"role": "ai", "content": ai_response})
    st.rerun()


def _render_report_page():
    """Render the post-session learning report page."""
    st.markdown("""
    <div class="report-header">
        <h1 style="color: #2d3436; font-weight: 700; margin-bottom: 8px;">
            Learning Report
        </h1>
        <p style="color: #636e72; font-size: 16px;">
            Your session summary and performance analysis
        </p>
    </div>
    """, unsafe_allow_html=True)

    # Placeholder report content
    st.info("The detailed report with pronunciation trends, error analysis charts, "
            "and AI-generated improvement suggestions will be implemented in PR3.")

    # Back button
    if st.button("← Back to Practice", use_container_width=False):
        st.session_state.show_report = False
        st.rerun()


# ============================================================
# Run Application
# ============================================================
if __name__ == "__main__":
    main()
