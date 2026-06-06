"""
Sidebar component for scene selection, difficulty, model switching,
and session management.
"""

import streamlit as st
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import SCENES, DIFFICULTY_LEVELS, DEFAULT_MODEL, APP_NAME, APP_VERSION
from utils.db import get_active_session, create_session, end_session


def render_sidebar():
    """Render the full sidebar with all controls."""

    with st.sidebar:
        # ============================================================
        # App Header
        # ============================================================
        st.markdown(f"""
        <div style="text-align: center; padding: 20px 0 10px 0;">
            <h1 style="color: #ffffff; font-size: 1.5rem; margin: 0; font-weight: 700;">
                {APP_NAME}
            </h1>
            <p style="color: #90a4ae; font-size: 0.8rem; margin: 4px 0 0 0;">
                v{APP_VERSION} | AI-Powered Speaking Practice
            </p>
        </div>
        """, unsafe_allow_html=True)

        st.divider()

        # ============================================================
        # Initialize Session State
        # ============================================================
        _init_session_state()

        # ============================================================
        # Scene Selection
        # ============================================================
        st.markdown("### 练习场景")

        scene_keys = list(SCENES.keys())
        scene_labels = [f"{SCENES[k]['icon']} {SCENES[k]['name']}" for k in scene_keys]

        current_scene_idx = scene_keys.index(st.session_state.current_scene)
        selected_scene_label = st.selectbox(
            "选择场景",
            scene_labels,
            index=current_scene_idx,
            label_visibility="collapsed",
        )
        selected_scene_idx = scene_labels.index(selected_scene_label)
        new_scene = scene_keys[selected_scene_idx]

        # Show scene description
        st.caption(f"_{SCENES[new_scene]['description']}_")

        # ============================================================
        # Difficulty Selection
        # ============================================================
        st.markdown("### 难度档位")

        diff_keys = list(DIFFICULTY_LEVELS.keys())
        diff_labels = [
            f"{DIFFICULTY_LEVELS[k]['name']}"
            for k in diff_keys
        ]

        current_diff_idx = diff_keys.index(st.session_state.current_difficulty)
        selected_diff_label = st.radio(
            "选择难度",
            diff_labels,
            index=current_diff_idx,
            label_visibility="collapsed",
            horizontal=True,
        )
        new_difficulty = diff_keys[diff_labels.index(selected_diff_label)]

        # Difficulty description
        diff_descriptions = {
            "beginner": "基础词汇，慢速对话，耐心引导",
            "intermediate": "中等词汇，自然语速，适当挑战",
            "advanced": "高级词汇，母语语速，深度讨论",
        }
        st.caption(f"_{diff_descriptions[new_difficulty]}_")

        # ============================================================
        # Model Selection
        # ============================================================
        st.markdown("### AI 模型")

        model_options = ["openai", "deepseek"]
        model_labels = ["OpenAI GPT-4o", "DeepSeek"]

        current_model_idx = model_options.index(st.session_state.current_model)
        new_model_label = st.radio(
            "选择模型",
            model_labels,
            index=current_model_idx,
            label_visibility="collapsed",
            horizontal=True,
        )
        new_model = model_options[model_labels.index(new_model_label)]

        # Model description
        model_descriptions = {
            "openai": "对话最自然流畅，推荐使用",
            "deepseek": "国产模型，成本极低",
        }
        st.caption(f"_{model_descriptions[new_model]}_")

        st.divider()

        # ============================================================
        # Session Controls
        # ============================================================
        st.markdown("### 会话管理")

        col1, col2 = st.columns(2)

        with col1:
            if st.button(" 新建会话", use_container_width=True, type="primary"):
                _handle_new_session()

        with col2:
            if st.button(" 结束会话", use_container_width=True):
                _handle_end_session()

        # Session status indicator
        if st.session_state.session_active:
            session = get_active_session()
            if session:
                rounds = session.get("total_rounds", 0)
                st.markdown(f"""
                <div class="status-success" style="margin-top: 10px;">
                    <strong>会话进行中</strong><br>
                    场景: {SCENES[st.session_state.current_scene]['name']}<br>
                    难度: {DIFFICULTY_LEVELS[st.session_state.current_difficulty]['name']}<br>
                    轮次: {rounds}
                </div>
                """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div class="status-info" style="margin-top: 10px;">
                点击「新建会话」开始练习
            </div>
            """, unsafe_allow_html=True)

        st.divider()

        # ============================================================
        # Report Button
        # ============================================================
        st.markdown("### 学习报告")

        if st.button(" 生成课后报告", use_container_width=True, disabled=not st.session_state.session_active):
            st.session_state.show_report = True
            st.rerun()

        # ============================================================
        # Handle scene/difficulty/model changes
        # ============================================================
        if new_scene != st.session_state.current_scene:
            _handle_scene_change(new_scene)
        if new_difficulty != st.session_state.current_difficulty:
            _handle_difficulty_change(new_difficulty)
        if new_model != st.session_state.current_model:
            _handle_model_change(new_model)


def _init_session_state():
    """Initialize Streamlit session state variables."""
    defaults = {
        "current_scene": "job_interview",
        "current_difficulty": "beginner",
        "current_model": DEFAULT_MODEL,
        "session_active": False,
        "session_id": None,
        "show_report": False,
        "messages": [],
        "pending_user_audio": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _handle_new_session():
    """Create a new practice session."""
    # End existing session if active
    if st.session_state.session_active and st.session_state.session_id:
        end_session(st.session_state.session_id)

    # Create new session
    scene_name = SCENES[st.session_state.current_scene]["name"]
    session_id = create_session(
        scene_key=st.session_state.current_scene,
        scene_name=scene_name,
        difficulty=st.session_state.current_difficulty,
        model=st.session_state.current_model,
    )

    st.session_state.session_id = session_id
    st.session_state.session_active = True
    st.session_state.messages = []
    st.session_state.show_report = False


def _handle_end_session():
    """End the current practice session."""
    if st.session_state.session_active and st.session_state.session_id:
        end_session(st.session_state.session_id)
        st.session_state.session_active = False
        st.session_state.show_report = False


def _handle_scene_change(new_scene: str):
    """Handle scene change — reset session and messages."""
    if st.session_state.session_active:
        _handle_end_session()
    st.session_state.current_scene = new_scene
    st.session_state.messages = []
    st.rerun()


def _handle_difficulty_change(new_difficulty: str):
    """Handle difficulty change — reset session and messages."""
    if st.session_state.session_active:
        _handle_end_session()
    st.session_state.current_difficulty = new_difficulty
    st.session_state.messages = []
    st.rerun()


def _handle_model_change(new_model: str):
    """Handle model change."""
    st.session_state.current_model = new_model
