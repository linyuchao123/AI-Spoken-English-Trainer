"""FastAPI backend entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils.db import init_db
from backend.api.auth import router as auth_router
from backend.api.scenes import router as scenes_router
from backend.api.sessions import router as sessions_router
from backend.api.grammar import router as grammar_router
from backend.api.tts import router as tts_router
from backend.api.pronunciation import router as pronunciation_router
from backend.api.report import router as report_router

app = FastAPI(title="AI Spoken English Trainer", version="1.0.0")

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

app.include_router(auth_router)
app.include_router(scenes_router)
app.include_router(sessions_router)
app.include_router(grammar_router)
app.include_router(tts_router)
app.include_router(pronunciation_router)
app.include_router(report_router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
