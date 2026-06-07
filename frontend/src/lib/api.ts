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

// Session detail (for history review)
export interface DetailPronunciation {
  overall_score: number;
  accuracy_score: number;
  fluency_score: number;
  completeness_score: number;
  words: WordScore[];
}

export interface DetailGrammar {
  original_text: string;
  corrected_text: string;
  error_type: string;
  explanation: string;
  explanation_cn: string;
  better_expression: string;
}

export interface DetailMessage {
  id: number;
  role: string;
  content: string;
  translation_cn: string;
  pronunciation: DetailPronunciation | null;
  grammar: DetailGrammar | null;
}

export interface SessionDetail {
  session_id: number;
  scene_name: string;
  scene_key: string;
  difficulty: string;
  model: string;
  status: string;
  total_rounds: number;
  avg_pronunciation_score: number;
  created_at: string;
  ended_at: string;
  messages: DetailMessage[];
  evaluation: Evaluation | null;
}

export interface Evaluation {
  overall_score: number;
  grammar_score: number;
  vocabulary_score: number;
  fluency_score: number;
  expression_score: number;
  naturalness_score: number;
  emotion_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
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

  getDetail: (sessionId: number) =>
    api.get<SessionDetail>(`/api/sessions/${sessionId}/detail`),

  delete: (sessionId: number) =>
    api.delete<{ ok: boolean }>(`/api/sessions/${sessionId}`),
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

// ============================================================
// TTS API
// ============================================================

export interface TTSVoice {
  key: string;
  name: string;
  gender: string;
}

export interface TTSVoices {
  voices: Record<string, TTSVoice[]>;
}

export interface TTSResult {
  audio_base64: string;
  format: string;
  voice: string;
  provider: string;
}

export const ttsApi = {
  speak: (text: string, voice = "default", provider = "edge") =>
    api.post<TTSResult>("/api/tts/speak", { text, voice, provider }),

  getVoices: () => api.get<TTSVoices>("/api/tts/voices"),
};

// ============================================================
// Pronunciation API
// ============================================================

export interface WordScore {
  word: string;
  accuracy_score: number;
  error_type: string;
  expected_pronunciation: string;
  correction_cn: string;
}

export interface PronunciationResult {
  accuracy_score: number;
  fluency_score: number;
  completeness_score: number;
  overall_score: number;
  stress_score: number;
  intonation_score: number;
  rhythm_score: number;
  words: WordScore[];
  phoneme_highlights: string[];
  summary_en: string;
  summary_cn: string;
  suggestions: string[];
  error: string;
}

export const pronunciationApi = {
  assess: (recognized_text: string, reference_text: string) =>
    api.post<PronunciationResult>("/api/pronunciation/assess", {
      recognized_text,
      reference_text,
    }),
};

// ============================================================
// Report API
// ============================================================

export interface ScorePoint {
  round: number;
  score: number;
}

export interface ScoreBreakdown {
  grammar_score: number;
  vocabulary_score: number;
  fluency_score: number;
  expression_score: number;
  naturalness_score: number;
  emotion_score: number;
}

export interface SentenceAnalysisItem {
  message_index: number;
  original_en: string;
  translation_cn: string;
  pronunciation_issues: string[];
  grammar_issues: string[];
  expression_improvements: string[];
}

export interface ReportData {
  session_id: number;
  scene_name: string;
  difficulty: string;
  model: string;
  total_rounds: number;
  avg_pronunciation_score: number;
  created_at: string;
  ended_at: string;
  message_count: number;
  score_count: number;
  correction_count: number;
  error_stats: Record<string, number>;
  score_history: ScorePoint[];
  score_breakdown: ScoreBreakdown | null;
  summary: string;
  summary_cn: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  topics_covered: string[];
  level_assessment: string;
  level_assessment_cn: string;
  sentence_analyses: SentenceAnalysisItem[];
}

export const reportApi = {
  get: (sessionId: number) => api.get<ReportData>(`/api/report/${sessionId}`),
  getLatest: () => api.get<ReportData>("/api/report/active/latest"),
};

export default api;
