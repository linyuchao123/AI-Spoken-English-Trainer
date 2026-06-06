"""
FastAPI backend entry point for AI Spoken English Trainer.
Run with: uvicorn backend.main:app --reload --port 8000
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.db import init_db

from backend.api.auth import router as auth_router
from backend.api.scenes import router as scenes_router
from backend.api.sessions import router as sessions_router

# Initialize database
init_db()

app = FastAPI(
    title="AI Spoken English Trainer API",
    version="2.0.0",
    description="Backend API for the AI English speaking practice platform.",
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(scenes_router)
app.include_router(sessions_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "AI Spoken English Trainer"}
