"""
Scenes API: returns available practice scenes, difficulty levels, and models.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter
from backend.models.schemas import SceneResponse, DifficultyResponse, ScenesConfigResponse
from config.settings import SCENES, DIFFICULTY_LEVELS

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


@router.get("", response_model=ScenesConfigResponse)
async def get_scenes():
    """Get all available scenes, difficulty levels, and model options."""
    scenes = [
        SceneResponse(
            key=key,
            name=scene["name"],
            icon=scene["icon"],
            description=scene["description"],
        )
        for key, scene in SCENES.items()
    ]

    difficulties = [
        DifficultyResponse(
            key=key,
            name=level["name"],
            color=level["color"],
        )
        for key, level in DIFFICULTY_LEVELS.items()
    ]

    return ScenesConfigResponse(
        scenes=scenes,
        difficulties=difficulties,
        models=["openai", "deepseek"],
    )
