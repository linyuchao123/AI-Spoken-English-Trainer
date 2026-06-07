"""
SQLite database module for the AI Spoken English Trainer.
Manages users, sessions, messages, pronunciation scores, and grammar corrections.
"""

import sqlite3
import json
import os
import hashlib
import secrets
from datetime import datetime
from typing import Optional


DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "sessions.db")


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database tables if they don't exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            avatar_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT NULL,
            scene_key TEXT NOT NULL,
            scene_name TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            total_rounds INTEGER DEFAULT 0,
            avg_pronunciation_score REAL DEFAULT 0.0,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'ai')),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pronunciation_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            message_id INTEGER NOT NULL,
            overall_score REAL NOT NULL,
            accuracy_score REAL,
            fluency_score REAL,
            completeness_score REAL,
            error_details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS grammar_corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            message_id INTEGER NOT NULL,
            original_text TEXT NOT NULL,
            corrected_text TEXT NOT NULL,
            error_type TEXT,
            explanation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_scores_session ON pronunciation_scores(session_id);
        CREATE INDEX IF NOT EXISTS idx_corrections_session ON grammar_corrections(session_id);
    """)

    conn.commit()
    conn.close()


# ============================================================
# User Operations
# ============================================================

def hash_password(password: str, salt: str = None) -> tuple:
    """Hash a password with a salt using SHA-256. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    salted = salt + password
    password_hash = hashlib.sha256(salted.encode('utf-8')).hexdigest()
    return password_hash, salt


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    """Verify a password against the stored hash."""
    salted = salt + password
    computed_hash = hashlib.sha256(salted.encode('utf-8')).hexdigest()
    return computed_hash == stored_hash


def create_user(email: str, username: str, password: str) -> Optional[int]:
    """Create a new user. Returns user ID or None if email already exists."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        password_hash, salt = hash_password(password)
        cursor.execute(
            "INSERT INTO users (email, username, password_hash, salt) VALUES (?, ?, ?, ?)",
            (email.strip().lower(), username.strip(), password_hash, salt),
        )
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by email."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get a user by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def authenticate_user(email: str, password: str) -> Optional[dict]:
    """Authenticate a user by email and password. Returns user dict or None."""
    user = get_user_by_email(email)
    if not user:
        return None
    if verify_password(password, user["salt"], user["password_hash"]):
        return user
    return None


def update_user_avatar(user_id: int, avatar_url: str):
    """Update a user's avatar URL."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user_id))
    conn.commit()
    conn.close()


# ============================================================
# Session Operations
# ============================================================

def create_session(scene_key: str, scene_name: str, difficulty: str, model: str, user_id: int = None) -> int:
    """Create a new practice session. Returns session ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sessions (user_id, scene_key, scene_name, difficulty, model) VALUES (?, ?, ?, ?, ?)",
        (user_id, scene_key, scene_name, difficulty, model),
    )
    conn.commit()
    session_id = cursor.lastrowid
    conn.close()
    return session_id


def end_session(session_id: int):
    """Mark a session as ended and update statistics."""
    conn = get_connection()
    cursor = conn.cursor()

    # Calculate average pronunciation score
    cursor.execute(
        "SELECT AVG(overall_score) as avg_score, COUNT(*) as total "
        "FROM pronunciation_scores WHERE session_id = ?",
        (session_id,),
    )
    row = cursor.fetchone()
    avg_score = row["avg_score"] if row["avg_score"] else 0.0

    # Count total rounds
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ? AND role = 'user'",
        (session_id,),
    )
    rounds = cursor.fetchone()["cnt"]

    cursor.execute(
        "UPDATE sessions SET ended_at = ?, total_rounds = ?, avg_pronunciation_score = ?, status = 'ended' WHERE id = ?",
        (datetime.now().isoformat(), rounds, avg_score, session_id),
    )
    conn.commit()
    conn.close()


def get_session(session_id: int) -> Optional[dict]:
    """Get session details by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_active_session(user_id: int = None) -> Optional[dict]:
    """Get the most recent active session, optionally filtered by user."""
    conn = get_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute(
            "SELECT * FROM sessions WHERE status = 'active' AND user_id = ? ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
    else:
        cursor.execute(
            "SELECT * FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
        )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_sessions(user_id: int, limit: int = 20) -> list[dict]:
    """Get all sessions for a specific user, most recent first."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def delete_session(session_id: int) -> bool:
    """Delete a session and all related data (messages, scores, corrections).
    Returns True if deleted, False if session not found."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


# ============================================================
# Message Operations
# ============================================================

def add_message(session_id: int, role: str, content: str) -> int:
    """Add a message to a session. Returns message ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
        (session_id, role, content),
    )
    conn.commit()
    msg_id = cursor.lastrowid
    conn.close()
    return msg_id


def get_session_messages(session_id: int) -> list[dict]:
    """Get all messages for a session, ordered by creation time."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ============================================================
# Pronunciation Score Operations
# ============================================================

def add_pronunciation_score(
    session_id: int,
    message_id: int,
    overall_score: float,
    accuracy_score: float = 0.0,
    fluency_score: float = 0.0,
    completeness_score: float = 0.0,
    error_details: Optional[dict] = None,
) -> int:
    """Record a pronunciation score for a user message."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO pronunciation_scores 
           (session_id, message_id, overall_score, accuracy_score, fluency_score, completeness_score, error_details)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            message_id,
            overall_score,
            accuracy_score,
            fluency_score,
            completeness_score,
            json.dumps(error_details) if error_details else None,
        ),
    )
    conn.commit()
    score_id = cursor.lastrowid
    conn.close()
    return score_id


def get_session_scores(session_id: int) -> list[dict]:
    """Get all pronunciation scores for a session."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM pronunciation_scores WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ============================================================
# Grammar Correction Operations
# ============================================================

def add_grammar_correction(
    session_id: int,
    message_id: int,
    original_text: str,
    corrected_text: str,
    error_type: str = "",
    explanation: str = "",
) -> int:
    """Record a grammar correction for a user message."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO grammar_corrections 
           (session_id, message_id, original_text, corrected_text, error_type, explanation)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, message_id, original_text, corrected_text, error_type, explanation),
    )
    conn.commit()
    corr_id = cursor.lastrowid
    conn.close()
    return corr_id


def get_session_corrections(session_id: int) -> list[dict]:
    """Get all grammar corrections for a session."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM grammar_corrections WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_error_type_stats(session_id: int) -> dict:
    """Get error type statistics for a session. Returns {error_type: count}."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT error_type, COUNT(*) as cnt FROM grammar_corrections "
        "WHERE session_id = ? AND error_type != '' "
        "GROUP BY error_type ORDER BY cnt DESC",
        (session_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return {row["error_type"]: row["cnt"] for row in rows}


# Initialize database on module import
init_db()
