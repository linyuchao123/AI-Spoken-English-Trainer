"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { sessionsApi, Message, ttsApi, RealtimeFeedback } from "@/lib/api";
import {
  Mic, Send, MicOff, Sparkles, Volume2, Bot, User,
  MessageSquare, StopCircle, Globe, ChevronDown, ChevronUp,
  Languages, RefreshCw, AlertCircle, ImageOff, CheckCircle2, Play,
} from "lucide-react";

/* ──────────── Scene background helper ──────────── */
function getSceneBg(sceneKey: string, difficulty: string): string {
  return `/scenes/${sceneKey}/${difficulty}.png`;
}

/* ──────────── Web Speech Recognition Hook ──────────── */
interface SpeechState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string;
  volume: number; // simulated volume 0~1
}

function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>({
    isListening: false, isSupported: false, transcript: "", error: "", volume: 0,
  });
  const recognitionRef = useRef<any>(null);
  const shouldRestart = useRef(false);
  const finalTextRef = useRef("");
  const volumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setState((s) => ({ ...s, isSupported: false })); return; }
    setState((s) => ({ ...s, isSupported: true }));

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) { finalTextRef.current += " " + r[0].transcript; }
        else { interim += r[0].transcript; }
      }
      const display = (finalTextRef.current + " " + interim).trim();
      setState((s) => ({ ...s, transcript: display }));
    };

    recognition.onspeechstart = () => setState((s) => ({ ...s, volume: 0.7 }));
    recognition.onspeechend = () => setState((s) => ({ ...s, volume: 0.3 }));
    recognition.onaudiostart = () => setState((s) => ({ ...s, volume: 0.5 }));

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setState((s) => ({ ...s, error: event.error, isListening: false, volume: 0 }));
    };

    recognition.onend = () => {
      if (shouldRestart.current) {
        try { recognition.start(); } catch { /* already started */ }
      } else {
        setState((s) => ({ ...s, isListening: false, volume: 0 }));
      }
    };

    recognitionRef.current = recognition;
    return () => {
      shouldRestart.current = false;
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, []);

  // Simulate volume fluctuation while listening
  useEffect(() => {
    if (state.isListening) {
      volumeIntervalRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          volume: Math.max(0.15, Math.min(0.95, 0.5 + Math.random() * 0.4)),
        }));
      }, 120);
    } else {
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
    }
    return () => {
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    };
  }, [state.isListening]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = true;
    finalTextRef.current = "";
    setState((s) => ({ ...s, isListening: true, error: "", transcript: "", volume: 0.3 }));
    try { rec.start(); } catch { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = false;
    setState((s) => ({ ...s, isListening: false, volume: 0 }));
    try { rec.stop(); } catch { /* ignore */ }
  }, []);

  return { ...state, start, stop };
}

/* ──────────── TTS Audio Player ──────────── */
function playBase64Audio(base64: string, format = "mp3"): Promise<void> {
  return new Promise((resolve) => {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/* ──────────── Recording Waveform ──────────── */
function RecordingWaveform({ volume, isListening }: { volume: number; isListening: boolean }) {
  if (!isListening) return null;
  const bars = 7;
  return (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 8 + volume * 24 * (0.5 + 0.5 * Math.sin(i * 0.8));
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-red-400 transition-all duration-100"
            style={{ height: `${h}px`, opacity: 0.6 + volume * 0.4 }}
          />
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Score Ring Component (circular score display)
   ══════════════════════════════════════════════════════════════ */
function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const offset = circumference * (1 - progress);
  const color =
    score >= 90 ? "#22c55e" :
    score >= 75 ? "#3b82f6" :
    score >= 60 ? "#f59e0b" :
    score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Realtime Feedback Card (shown below user messages)
   ══════════════════════════════════════════════════════════════ */
function FeedbackCard({ feedback }: { feedback: RealtimeFeedback }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 ml-0 animate-fade-in">
      {/* Compact summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl
                   bg-indigo-500/10 border border-indigo-500/20
                   hover:bg-indigo-500/15 transition-all w-full text-left"
      >
        <ScoreRing score={feedback.overall_score} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/70 font-medium truncate">
            {feedback.summary_cn || "评分完成"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {feedback.grammar_errors.length > 0 && (
              <span className="text-[10px] text-amber-400/80">
                {feedback.grammar_errors.length} 个语法问题
              </span>
            )}
            {feedback.expression_suggestions.length > 0 && (
              <span className="text-[10px] text-emerald-400/80">
                {feedback.expression_suggestions.length} 个表达建议
              </span>
            )}
            {!feedback.has_errors && (
              <span className="text-[10px] text-emerald-400">👍 很棒!</span>
            )}
          </div>
        </div>
        {expanded ?
          <ChevronUp className="w-3.5 h-3.5 text-white/40 shrink-0" /> :
          <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
        }
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {/* Corrected sentence */}
          {feedback.corrected_sentence && feedback.corrected_sentence !== feedback.grammar_errors[0]?.original_text && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
              <p className="text-[10px] text-emerald-400/70 mb-0.5">✅ 修正后</p>
              <p className="text-xs text-white/80">{feedback.corrected_sentence}</p>
            </div>
          )}

          {/* Grammar errors */}
          {feedback.grammar_errors.map((err, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                  {err.error_type || "语法"}
                </span>
              </div>
              <p className="text-xs text-white/70">
                <span className="line-through text-red-400/80">{err.original_text}</span>
                {" → "}
                <span className="text-emerald-400">{err.corrected_text}</span>
              </p>
              {err.explanation && (
                <p className="text-[11px] text-white/50 mt-1">{err.explanation}</p>
              )}
              {err.explanation_cn && (
                <p className="text-[11px] text-white/35 mt-0.5">{err.explanation_cn}</p>
              )}
            </div>
          ))}

          {/* Expression suggestions */}
          {feedback.expression_suggestions.map((sug, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
              <p className="text-[10px] text-emerald-400/70 mb-0.5">💡 地道表达</p>
              <p className="text-xs text-white/70">
                <span className="text-white/50">{sug.original_phrase}</span>
                {" → "}
                <span className="text-emerald-400">{sug.improved_phrase}</span>
              </p>
              {sug.explanation && (
                <p className="text-[11px] text-white/50 mt-1">{sug.explanation}</p>
              )}
              {sug.explanation_cn && (
                <p className="text-[11px] text-white/35 mt-0.5">{sug.explanation_cn}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Chat Bubble Component
   ══════════════════════════════════════════════════════════════ */
function ChatBubble({
  message, isSpeaking, isAutoPlaying, onReplay,
  userInitial, translationCn, showTranslation, onToggleTranslation,
  feedback,
}: {
  message: Message & { translation_cn?: string };
  isSpeaking: boolean;
  isAutoPlaying: boolean;
  onReplay: (id: number, text: string) => void;
  userInitial: string;
  translationCn?: string;
  showTranslation?: boolean;
  onToggleTranslation?: (id: number) => void;
  feedback?: RealtimeFeedback | null;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-slide-up">
        <div className="max-w-[72%]">
          <div className="px-5 py-3 rounded-2xl rounded-br-md text-sm leading-relaxed
                          bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white
                          shadow-lg shadow-indigo-500/20">
            {message.content}
          </div>
          {/* Real-time feedback card */}
          {feedback && <FeedbackCard feedback={feedback} />}
          <p className="text-right text-[10px] text-white/25 mt-1 mr-1">
            {formatTimestamp(message.created_at)}
          </p>
        </div>
        {/* User avatar */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8956C] to-[#E0B894]
                        flex items-center justify-center text-white text-sm font-bold
                        shadow-md shadow-amber-500/15 shrink-0 mt-1">
          {userInitial}
        </div>
      </div>
    );
  }

  // AI message
  const hasTranslation = !!translationCn;

  return (
    <div className="flex gap-3 animate-slide-up">
      {/* AI avatar */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                      border border-white/10 flex items-center justify-center
                      shadow-lg shrink-0 mt-1">
        <Bot className="w-4.5 h-4.5 text-[#9B8FFF]" />
      </div>

      <div className="max-w-[72%]">
        <div className="px-5 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed
                        bg-white/90 backdrop-blur-sm border border-white/20
                        text-[#1E293B] shadow-md">
          {message.content}
        </div>

        {/* Translation (expandable) */}
        {hasTranslation && (
          <div className="mt-1.5 ml-1">
            <button
              onClick={() => onToggleTranslation?.(message.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px]
                         text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              <Languages className="w-3 h-3" />
              {showTranslation ? "收起翻译" : "查看翻译"}
              {showTranslation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showTranslation && (
              <div className="mt-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs
                              text-white/60 leading-relaxed animate-fade-in">
                {translationCn}
              </div>
            )}
          </div>
        )}

        {/* TTS controls */}
        <div className="flex items-center gap-2 mt-1.5 ml-1">
          {isAutoPlaying ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#5B4FCF]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B4FCF] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#5B4FCF]" />
              </span>
              播放中
            </span>
          ) : (
            <button
              onClick={() => onReplay(message.id, message.content)}
              disabled={isSpeaking}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                          transition-all duration-200 ${
                            isSpeaking
                              ? "text-text-light/30 cursor-not-allowed"
                              : "text-white/40 hover:text-[#9B8FFF] hover:bg-white/8"
                          }`}
              title="点击重新播放"
            >
              <Volume2 className="w-3 h-3" />
              重播
            </button>
          )}
          <span className="text-[10px] text-white/20">
            {formatTimestamp(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   No Session View — Step-by-step onboarding
   ══════════════════════════════════════════════════════════════ */
function NoSessionView() {
  const { scenes, difficulties, models, currentScene, currentDifficulty, currentModel,
          currentTrainingMode, setCurrentTrainingMode, createSession } = useAppStore();
  const currentSceneData = scenes.find((s) => s.key === currentScene);
  const currentModelData = models.find((m) => m.key === currentModel);
  const currentDifficultyData = difficulties.find((d) => d.key === currentDifficulty);
  const DIFFICULTY_ICONS: Record<string, string> = {
    beginner: "🌱", intermediate: "🌿", advanced: "🌳",
  };

  const STEPS = [
    { icon: currentSceneData?.icon || "💬", title: "选场景",
      desc: currentSceneData?.name || "职场面试", detail: currentSceneData?.description || "",
      active: true },
    { icon: DIFFICULTY_ICONS[currentDifficulty] || "📊", title: "定难度",
      desc: currentDifficultyData?.name || "初级", detail: (currentDifficultyData?.name || "初级") + "难度",
      active: true },
    { icon: currentModelData?.icon || "🤖", title: "选模型",
      desc: currentModelData?.name || "GPT-4o", detail: currentModelData?.description?.slice(0, 30) || "",
      active: true },
  ];

  const handleQuickStart = async () => {
    await createSession();
    // activeSession will be set in the store → component re-renders to chat view
  };

  return (
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-[#FAFAF8] to-[#F0F0EB]">
      <div className="max-w-lg w-full mx-auto animate-fade-in">
        {/* Hero icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#5B4FCF]/15 to-[#7C6FF7]/10
                          border border-[#5B4FCF]/15 flex items-center justify-center mx-auto mb-5
                          shadow-lg shadow-indigo-500/5">
            <MessageSquare className="w-10 h-10 text-[#5B4FCF]/60" />
          </div>
          <h2 className="text-2xl font-extrabold text-text-primary mb-2">
            开始你的英语对话之旅
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
            三步完成配置，即刻与 AI 开始沉浸式口语练习
          </p>
        </div>

        {/* Step-by-step guide with visual connectors */}
        <div className="relative flex items-start justify-between mb-8 px-2">
          {/* Connecting line */}
          <div className="absolute top-8 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-[#5B4FCF]/30 via-[#7C6FF7]/20 to-[#5B4FCF]/30" />

          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center z-10 group">
              {/* Step circle */}
              <div className="w-[52px] h-[52px] rounded-2xl bg-white border-2 border-[#5B4FCF]/20
                              flex items-center justify-center text-xl mb-2.5
                              shadow-md shadow-indigo-500/5
                              group-hover:border-[#5B4FCF]/40 group-hover:shadow-lg group-hover:shadow-indigo-500/10
                              group-hover:-translate-y-1
                              transition-all duration-200">
                <span>{step.icon}</span>
              </div>
              {/* Label */}
              <p className="text-xs font-bold text-text-primary mb-0.5">{step.title}</p>
              <p className="text-[11px] text-[#5B4FCF] font-semibold">{step.desc}</p>
              {step.detail && (
                <p className="text-[9px] text-text-light/60 mt-0.5 hidden sm:block max-w-[100px]">
                  {step.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Configuration summary bar */}
        <div className="mb-6 px-4 py-3 rounded-2xl bg-white border border-border/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span>{currentSceneData?.icon || "💼"} {currentSceneData?.name || "职场面试"}</span>
              <span className="text-text-light">·</span>
              <span>{DIFFICULTY_ICONS[currentDifficulty] || "📊"} {currentDifficultyData?.name || "初级"}</span>
              <span className="text-text-light">·</span>
              <span>{currentModelData?.icon || "🤖"} {currentModelData?.name || "GPT-4o"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600">就绪</span>
            </div>
          </div>
        </div>

        {/* Training Mode Selector */}
        <div className="mb-6">
          <p className="text-xs text-text-secondary mb-3 font-medium">选择训练模式</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCurrentTrainingMode("immersive")}
              className={`px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
                currentTrainingMode === "immersive"
                  ? "border-[#5B4FCF]/50 bg-[#5B4FCF]/10 shadow-lg shadow-indigo-500/10"
                  : "border-border/60 bg-white hover:border-[#5B4FCF]/20"
              }`}
            >
              <p className="text-sm font-bold text-text-primary">🎯 沉浸式练习</p>
              <p className="text-[10px] text-text-light mt-0.5 leading-relaxed">
                对话不打断，结束后统一评估
              </p>
              {currentTrainingMode === "immersive" && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[#5B4FCF] text-white font-medium">
                  当前选择
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentTrainingMode("realtime")}
              className={`px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
                currentTrainingMode === "realtime"
                  ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-border/60 bg-white hover:border-emerald-500/20"
              }`}
            >
              <p className="text-sm font-bold text-text-primary">⚡ 实时练习</p>
              <p className="text-[10px] text-text-light mt-0.5 leading-relaxed">
                每轮对话后立即纠错+打分
              </p>
              {currentTrainingMode === "realtime" && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-medium">
                  当前选择
                </span>
              )}
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-6">
          <p className="text-text-secondary text-sm mb-4 leading-relaxed">
            当前配置可直接开始练习，或在左侧面板调整场景、难度与模型
          </p>
          <button
            onClick={handleQuickStart}
            className="group inline-flex items-center gap-2.5 px-10 py-3.5 rounded-2xl text-base font-bold text-white
                       bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7]
                       shadow-xl shadow-indigo-500/30
                       hover:shadow-2xl hover:shadow-indigo-500/45 hover:-translate-y-0.5 hover:scale-[1.02]
                       active:scale-[0.98]
                       transition-all duration-200
                       relative overflow-hidden"
          >
            <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,transparent,50%,rgba(255,255,255,0.15),transparent,transparent)] translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
            <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
            新建会话
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[10px] text-text-light/50">
          也可在左侧〈练习控制台〉中调整配置后点击「新建会话」
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Practice Page
   ══════════════════════════════════════════════════════════════ */
export default function PracticePage() {
  const { scenes, difficulties, models, activeSession, endSession } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [messages, setMessages] = useState<(Message & { translation_cn?: string })[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [failedText, setFailedText] = useState("");
  const [speakingMap, setSpeakingMap] = useState<Record<number, boolean>>({});
  const [autoPlayedIds, setAutoPlayedIds] = useState<Set<number>>(new Set());
  const [autoPlayingId, setAutoPlayingId] = useState<number | null>(null);
  const [bgError, setBgError] = useState(false);
  const [expandedTranslations, setExpandedTranslations] = useState<Set<number>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<number, RealtimeFeedback>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scene = scenes.find((s) => s.key === activeSession?.scene_key);
  const difficulty = difficulties.find((d) => d.key === activeSession?.difficulty);
  const model = models.find((m) => m.key === activeSession?.model);
  const sceneKey = activeSession?.scene_key || "job_interview";
  const bgImage = getSceneBg(sceneKey, activeSession?.difficulty || "beginner");
  const userInitial = user?.username?.charAt(0).toUpperCase() || "U";

  // Sync speech transcript to input
  useEffect(() => { if (speech.transcript) setInput(speech.transcript); }, [speech.transcript]);

  // Auto-send when speech stops and has content
  useEffect(() => {
    if (!speech.isListening && speech.transcript.trim() && activeSession) {
      const timer = setTimeout(() => {
        handleSendWithText(speech.transcript.trim());
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [speech.isListening]);

  // Load messages when session changes
  useEffect(() => {
    if (activeSession) {
      sessionsApi.getMessages(activeSession.id).then(({ data }) => {
        setMessages(data);
        setAutoPlayedIds(new Set());
        setExpandedTranslations(new Set());
        setFeedbackMap({});
        setBgError(false);
      }).catch(() => setMessages([]));
    } else {
      setMessages([]);
    }
  }, [activeSession?.id]);

  // Load session detail for translations
  useEffect(() => {
    if (!activeSession || messages.length === 0) return;
    const aiMsgsWithoutTranslation = messages.filter(
      (m) => m.role === "ai" && !m.translation_cn
    );
    if (aiMsgsWithoutTranslation.length === 0) return;

    sessionsApi.getDetail(activeSession.id).then(({ data }) => {
      if (!data.messages) return;
      setMessages((prev) =>
        prev.map((msg) => {
          const detailMsg = data.messages.find((dm) => dm.id === msg.id);
          if (detailMsg?.translation_cn) {
            return { ...msg, translation_cn: detailMsg.translation_cn };
          }
          return msg;
        })
      );
    }).catch(() => {});
  }, [activeSession?.id, messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-play TTS for the last AI message
  useEffect(() => {
    const lastAiMsg = [...messages].reverse().find((m) => m.role === "ai");
    if (!lastAiMsg || autoPlayedIds.has(lastAiMsg.id)) return;

    setAutoPlayedIds((prev) => new Set(prev).add(lastAiMsg.id));
    autoSpeak(lastAiMsg.id, lastAiMsg.content);
  }, [messages]);

  const handleSend = () => handleSendWithText(input);

  const handleSendWithText = async (text: string) => {
    if (!text.trim() || !activeSession || sending) return;
    const t = text.trim();
    if (t === input.trim()) setInput("");
    setFailedText("");
    setSendError("");
    setSending(true);
    try {
      const { data } = await sessionsApi.sendMessage(activeSession.id, t);
      const msgs = data.messages || [];
      setMessages(msgs.map((m) => ({ ...m })));

      // Store real-time feedback if present
      if (data.feedback) {
        // Associate feedback with the latest user message
        const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
        if (lastUserMsg) {
          setFeedbackMap((prev) => ({
            ...prev,
            [lastUserMsg.id]: data.feedback!,
          }));
        }
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || "消息发送失败，请重试";
      setSendError(errMsg);
      setFailedText(t);
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleRetry = () => {
    if (failedText) {
      handleSendWithText(failedText);
    }
  };

  const autoSpeak = async (msgId: number, text: string) => {
    setAutoPlayingId(msgId);
    try {
      const { data } = await ttsApi.speak(text);
      await playBase64Audio(data.audio_base64, data.format);
    } catch (err) {
      console.error("TTS playback failed:", err);
    } finally {
      setAutoPlayingId(null);
    }
  };

  const handleReplay = async (msgId: number, text: string) => {
    if (speakingMap[msgId]) return;
    setSpeakingMap((prev) => ({ ...prev, [msgId]: true }));
    try {
      const { data } = await ttsApi.speak(text);
      await playBase64Audio(data.audio_base64, data.format);
    } catch (err) {
      console.error("TTS playback failed:", err);
    } finally {
      setSpeakingMap((prev) => ({ ...prev, [msgId]: false }));
    }
  };

  const handleToggleTranslation = (msgId: number) => {
    setExpandedTranslations((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Audio ref for cleanup (must be declared before handlers that use it)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleEndSession = async () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    await endSession();
    router.push("/history");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeSession) return <NoSessionView />;

  const roundCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="h-full flex flex-col relative">
      {/* ── Scene Background ── */}
      <div className="absolute inset-0 z-0">
        {!bgError && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          >
            <img
              src={bgImage}
              alt=""
              className="hidden"
              onError={() => setBgError(true)}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1119]/85 via-[#1A1D28]/75 to-[#2A2E3D]/90" />
        {bgError && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1D28] via-[#232738] to-[#2A2E3D] flex items-center justify-center">
            <div className="text-center opacity-30">
              <ImageOff className="w-12 h-12 text-white/20 mx-auto mb-2" />
              <p className="text-white/20 text-xs">{scene?.icon} {scene?.name}</p>
            </div>
          </div>
        )}
        {/* Subtle grain/vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,17,25,0.6)_100%)]" />
      </div>

      {/* ── Session Header ── */}
      <div className="relative z-10 flex items-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 shrink-0
                      bg-gradient-to-r from-[#1A1D28]/90 to-[#232738]/90 backdrop-blur-md
                      border-b border-white/5">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#5B4FCF]/30 to-[#9B8FFF]/20
                          border border-[#5B4FCF]/20 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-base md:text-xl">{scene?.icon || "💬"}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-white text-xs md:text-sm font-bold leading-tight truncate">
              {scene?.name || "Practice"}
              <span className="text-white/40 font-normal"> · {difficulty?.name || ""}</span>
            </h3>
            <div className="hidden md:flex items-center gap-2">
              <p className="text-white/35 text-[11px] leading-tight">
                {scene?.description || ""}
              </p>
              {model && (
                <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                  {model.icon} {model.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Round counter + Live indicator */}
        <div className="ml-auto flex items-center gap-1.5 md:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
            <MessageSquare className="w-3.5 h-3.5 text-[#9B8FFF]" />
            <span className="text-white/60 text-xs font-medium">{roundCount} 轮</span>
          </div>

          <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
            <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-emerald-400" />
            </span>
            <span className="text-emerald-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Live</span>
          </div>

          {/* End Session Button */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-1 md:py-1.5 rounded-xl
                       bg-red-500/10 border border-red-500/20 text-red-400
                       hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300
                       text-[10px] md:text-xs font-semibold transition-all duration-200"
          >
            <StopCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">结束会话</span>
          </button>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5 space-y-4 md:space-y-5">
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10
                              flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#9B8FFF]/60" />
              </div>
              <p className="text-white/40 text-sm mb-1">
                {scene?.icon} 正在准备 {scene?.name} 场景...
              </p>
              <p className="text-white/20 text-xs">
                点击下方麦克风或输入英语开始对话
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isSpeaking={!!speakingMap[msg.id]}
            isAutoPlaying={autoPlayingId === msg.id}
            onReplay={handleReplay}
            userInitial={userInitial}
            translationCn={msg.translation_cn}
            showTranslation={expandedTranslations.has(msg.id)}
            onToggleTranslation={handleToggleTranslation}
            feedback={msg.role === "user" ? feedbackMap[msg.id] || null : null}
          />
        ))}

        {/* Sending indicator */}
        {sending && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                            border border-white/10 flex items-center justify-center shadow-lg">
              <Bot className="w-4.5 h-4.5 text-[#9B8FFF]" />
            </div>
            <div className="px-5 py-3 rounded-2xl rounded-bl-md bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white/50">AI 正在思考</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="relative z-10 shrink-0 px-3 md:px-6 pb-3 md:pb-5 pt-2 md:pt-3
                      bg-gradient-to-t from-[#1A1D28]/95 via-[#1A1D28]/80 to-transparent
                      backdrop-blur-sm">
        {/* Send error with retry */}
        {sendError && (
          <div className="max-w-3xl mx-auto mb-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20
                          flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-red-400 text-xs">{sendError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSendError("")}
                className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
              >
                忽略
              </button>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/15 border border-red-500/25
                           text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                重试
              </button>
            </div>
          </div>
        )}

        {/* Voice recording waveform overlay */}
        {speech.isListening && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center justify-center gap-3 animate-fade-in">
            <RecordingWaveform volume={speech.volume} isListening={speech.isListening} />
            <span className="text-red-400/80 text-xs font-medium animate-pulse">
              🎤 正在聆听...
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 md:gap-3 max-w-3xl mx-auto">
          {/* Mic Button */}
          {speech.isSupported ? (
            <button
              onClick={speech.isListening ? speech.stop : speech.start}
              disabled={sending}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white
                          shadow-lg transition-all duration-300 shrink-0 ${
                            speech.isListening
                              ? "bg-red-500 animate-pulse shadow-red-500/30 scale-105"
                              : "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-500/25 hover:scale-105 active:scale-95"
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
              title={speech.isListening ? "停止录音 (Stop)" : "开始语音输入 (Start Speaking)"}
            >
              {speech.isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </button>
          ) : (
            <button
              disabled
              className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 cursor-not-allowed shrink-0"
              title="浏览器不支持语音识别"
            >
              <MicOff className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Text Input — textarea for multiline support */}
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                speech.isListening
                  ? "🎤 正在聆听... 请说英语"
                  : "输入英语或点击麦克风语音输入... (Shift+Enter 换行)"
              }
              disabled={sending || speech.isListening}
              rows={1}
              className={`w-full px-5 py-3 pr-12 rounded-2xl text-sm resize-none
                          bg-white/8 border backdrop-blur-sm text-white
                          placeholder:text-white/30 focus:outline-none
                          transition-all duration-200 min-h-[48px] max-h-[120px] ${
                            speech.isListening
                              ? "border-red-400/50 ring-2 ring-red-400/10"
                              : "border-white/10 focus:border-[#5B4FCF]/50 focus:ring-2 focus:ring-[#5B4FCF]/10"
                          }`}
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || speech.isListening}
              className="absolute right-2 bottom-2 w-8 h-8 rounded-xl
                         bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white
                         flex items-center justify-center
                         hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105
                         active:scale-95
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
                         transition-all duration-200"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-center text-[10px] text-white/25 mt-2 max-w-3xl mx-auto hidden md:block">
          {speech.error
            ? `⚠️ 语音错误: ${speech.error} — 请重试或手动输入`
            : speech.isListening
              ? "正在录音 — 再次点击麦克风停止并自动发送"
              : `💡 语音输入 · AI 自动朗读 · 点击翻译查看中文 · ${model?.name || ""} 模型驱动`
          }
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════ 辅助函数 ═══════════════════ */

function formatTimestamp(createdAt: string | null): string {
  if (!createdAt) return "";
  try {
    const d = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
