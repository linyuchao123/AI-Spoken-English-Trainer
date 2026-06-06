"""
Global configuration and settings.
Loads API keys and model configurations from environment variables.
"""

import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# ============================================================
# API Keys
# ============================================================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastasia")

# ============================================================
# Model Selection
# ============================================================
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "openai")  # "openai" or "deepseek"

# ============================================================
# OpenAI Model Configurations
# ============================================================
OPENAI_LLM_MODEL = "gpt-4o"
OPENAI_ASR_MODEL = "whisper-1"
OPENAI_TTS_MODEL = "tts-1"
OPENAI_TTS_VOICE = "alloy"  # Options: alloy, echo, fable, onyx, nova, shimmer

# ============================================================
# DeepSeek Model Configurations
# ============================================================
DEEPSEEK_LLM_MODEL = "deepseek-chat"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# ============================================================
# Azure Speech Configuration
# ============================================================
# Pronunciation assessment reference text (set dynamically per utterance)
AZURE_PRONUNCIATION_REFERENCE_TEXT = ""

# ============================================================
# Application Settings
# ============================================================
APP_NAME = "AI英语口语陪练"
APP_VERSION = "1.0.0"
MAX_CONVERSATION_ROUNDS = 30  # Maximum rounds per session
AUDIO_SAMPLE_RATE = 16000
AUDIO_CHANNELS = 1
AUDIO_FORMAT = "wav"

# ============================================================
# Scene Configuration
# ============================================================
SCENES = {
    "job_interview": {
        "name": "职场面试",
        "icon": "💼",
        "description": "模拟英文工作面试场景",
        "image": "/scenes/job_interview.jpg",
        "overlay_color": "rgba(30, 41, 59, 0.55)",
    },
    "restaurant": {
        "name": "餐厅点餐",
        "icon": "🍽️",
        "description": "模拟英文餐厅点餐场景",
        "image": "/scenes/restaurant.jpg",
        "overlay_color": "rgba(44, 28, 12, 0.50)",
    },
    "business_meeting": {
        "name": "商务会议",
        "icon": "📊",
        "description": "模拟英文商务会议场景",
        "image": "/scenes/business_meeting.jpg",
        "overlay_color": "rgba(20, 30, 48, 0.55)",
    },
}

DIFFICULTY_LEVELS = {
    "beginner": {"name": "初级", "color": "#4caf50"},
    "intermediate": {"name": "中级", "color": "#ff9800"},
    "advanced": {"name": "高级", "color": "#f44336"},
}
