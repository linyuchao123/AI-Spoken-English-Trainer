import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
// Auth API
// ============================================================

export interface User {
  id: number;
  email: string;
  username: string;
  avatar_url: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { email, password }),

  register: (email: string, username: string, password: string) =>
    api.post<AuthResponse>("/api/auth/register", { email, username, password }),

  logout: () => api.post("/api/auth/logout"),

  me: () => api.get<User>("/api/auth/me"),
};

// ============================================================
// Scenes API
// ============================================================

export interface Scene {
  key: string;
  name: string;
  icon: string;
  description: string;
}

export interface Difficulty {
  key: string;
  name: string;
  color: string;
}

export interface Model {
  key: string;
  name: string;
  icon: string;
  description: string;
}

export interface ScenesConfig {
  scenes: Scene[];
  difficulties: Difficulty[];
  models: Model[];
}

export const scenesApi = {
  getConfig: () => api.get<ScenesConfig>("/api/scenes"),
};

// ============================================================
// Sessions API
// ============================================================

export interface Session {
  id: number;
  scene_key: string;
  scene_name: string;
  difficulty: string;
  model: string;
  status: string;
  total_rounds: number;
  avg_pronunciation_score: number;
  created_at: string | null;
  ended_at: string | null;
}

export interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
  created_at: string | null;
}

export const sessionsApi = {
  create: (scene_key: string, difficulty: string, model: string) =>
    api.post<Session>("/api/sessions", { scene_key, difficulty, model }),

  list: (limit = 20) => api.get<Session[]>("/api/sessions", { params: { limit } }),

  getActive: () => api.get<Session | null>("/api/sessions/active"),

  end: (sessionId: number) =>
    api.patch<Session>(`/api/sessions/${sessionId}/end`),

  getMessages: (sessionId: number) =>
    api.get<Message[]>(`/api/sessions/${sessionId}/messages`),

  sendMessage: (sessionId: number, content: string) =>
    api.post<Message[]>(`/api/sessions/${sessionId}/messages`, { content }),
};

// ============================================================
// Grammar API
// ============================================================

export interface GrammarErrorItem {
  type: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  explanation_cn: string;
}

export interface GrammarResult {
  has_errors: boolean;
  original: string;
  corrected: string;
  errors: GrammarErrorItem[];
}

export const grammarApi = {
  correct: (text: string, model: string) =>
    api.post<GrammarResult>("/api/grammar/correct", { text, model }),
};

export default api;
