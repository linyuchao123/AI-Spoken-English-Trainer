"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic, MicOff, Loader2, Target, TrendingUp, AlertCircle, RefreshCw,
  Shuffle, Pencil, Volume2, Zap, BarChart3, CheckCircle2, XCircle, Lightbulb,
  PanelLeftClose, PanelLeftOpen, Trash2, MicIcon
} from "lucide-react";
import { pronunciationApi, PronunciationResult, WordScore } from "@/lib/api";

/* ═══════════════════ 随机文本池 ═══════════════════ */

const SHORT_TEXTS = [
  "Hello, how are you doing today?",
  "What time does the meeting start?",
  "Could you please pass me the salt?",
  "I really enjoyed the movie last night.",
  "Where is the nearest subway station?",
  "Nice to meet you, my name is Alex.",
  "The weather is beautiful this morning.",
  "Would you like a cup of coffee?",
  "I need to finish this report by Friday.",
  "She has been working here since 2020.",
];

const MEDIUM_TEXTS = [
  "I've been learning English for about three years now, and I feel like I'm making good progress with my speaking skills.",
  "The restaurant was quite crowded when we arrived, so we had to wait for about twenty minutes before getting a table.",
  "If you want to improve your pronunciation, you should practice speaking out loud every day and listen to native speakers.",
  "Technology has changed the way we communicate with each other, making it easier to stay in touch with friends and family.",
  "Could you tell me how to get to the museum? I think I might have taken a wrong turn somewhere.",
  "The most important thing about learning a new language is to not be afraid of making mistakes when you speak.",
  "My favorite season is autumn because the weather is perfect and the changing leaves are absolutely beautiful.",
  "Before making a decision, it's always a good idea to consider all the possible options and their consequences.",
];

const LONG_TEXTS = [
  "Last summer, I traveled to Japan with my family and we spent two wonderful weeks exploring Tokyo, Kyoto, and Osaka. The food was incredible, the people were very friendly, and we learned so much about Japanese culture and history. One of my favorite experiences was visiting the ancient temples in Kyoto and participating in a traditional tea ceremony.",
  "The importance of regular exercise cannot be overstated. Not only does it help maintain a healthy weight and strengthen your cardiovascular system, but it also has significant benefits for your mental health. Studies have shown that people who exercise regularly tend to have lower rates of depression and anxiety, better sleep quality, and improved cognitive function.",
  "Climate change is one of the most pressing issues facing our world today. Rising global temperatures are causing ice caps to melt, sea levels to rise, and weather patterns to become increasingly unpredictable. If we don't take immediate action to reduce our carbon footprint and transition to renewable energy sources, the consequences could be catastrophic for future generations.",
  "When I first started my career as a software developer, I had no idea how much there was to learn. Every day brought new challenges and opportunities to grow. Looking back now after ten years, I can honestly say that the key to success in this field is never stopping learning. Technology evolves so quickly that what you knew yesterday might already be outdated today.",
];

const ALL_TEXTS = { short: SHORT_TEXTS, medium: MEDIUM_TEXTS, long: LONG_TEXTS } as const;

function getRandomText(length: keyof typeof ALL_TEXTS): string {
  const pool = ALL_TEXTS[length];
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ═══════════════════ 历史记录类型 ═══════════════════ */

interface HistoryItem {
  id: string;
  referenceText: string;
  recognizedText: string;
  overallScore: number;
  errorCount: number;
  timestamp: number;
  result: PronunciationResult;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ═══════════════════ 语音识别 Hook ═══════════════════ */

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript + " ";
        else interim += transcript;
      }
      setRecognizedText(finalTranscript.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setRecognizedText("");
    setInterimText("");
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const reset = useCallback(() => {
    stop();
    setRecognizedText("");
    setInterimText("");
  }, [stop]);

  return { isListening, recognizedText, interimText, start, stop, reset };
}

/* ═══════════════════ 评分圆环 ═══════════════════ */

function ScoreRing({ score, label, size = 80 }: { score: number; label?: string; size?: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const strokeW = size * 0.1;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : pct >= 50 ? "#f97316" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
            strokeWidth={strokeW} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <span className="absolute text-xl font-extrabold" style={{ color }}>{Math.round(score)}</span>
      </div>
      {label && <span className="text-[10px] text-text-light font-medium">{label}</span>}
    </div>
  );
}

/* ═══════════════════ 维度评分条 ═══════════════════ */

function DimBar({ label, score, icon, color }: { label: string; score: number; icon: React.ReactNode; color: string }) {
  const pct = Math.min((score / 100) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span> {label}
        </span>
        <span className="text-[11px] font-extrabold" style={{ color: score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444" }}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ═══════════════════ 单词错误卡片 ═══════════════════ */

function WordErrorCard({ w }: { w: WordScore }) {
  const hasError = w.error_type && w.error_type !== "None";
  return (
    <div className={`rounded-lg p-2.5 border text-xs transition-colors ${
      hasError
        ? "bg-red-50 border-red-200"
        : w.accuracy_score >= 90
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-bold ${hasError ? "text-red-700" : "text-emerald-700"}`}>
          {w.word}
        </span>
        <span className={`text-[10px] font-semibold ${hasError ? "text-red-500" : "text-emerald-500"}`}>
          {Math.round(w.accuracy_score)}%
        </span>
      </div>
      {hasError && (
        <div className="space-y-0.5">
          {w.expected_pronunciation && (
            <p className="text-[10px] text-blue-700">
              🔈 正确读音: <span className="font-mono font-semibold">{w.expected_pronunciation}</span>
            </p>
          )}
          {w.correction_cn && (
            <p className="text-[10px] text-red-600 leading-relaxed">{w.correction_cn}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ 主页面 ═══════════════════ */

export default function PronunciationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Text mode
  const [textMode, setTextMode] = useState<"manual" | "random">((() => {
    return searchParams.get("text") ? "manual" : "random";
  })());
  const [textLength, setTextLength] = useState<keyof typeof ALL_TEXTS>("short");
  const [referenceText, setReferenceText] = useState((() => {
    const paramText = searchParams.get("text");
    return paramText || getRandomText("short");
  })());

  // Assessment state
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState("");
  const speech = useSpeechRecognition();

  // History sidebar state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const STORAGE_KEY = "pronunciation_history_v1";
  const SIDEBAR_KEY = "pronunciation_sidebar_v1";

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
        }
      }
      const savedSidebar = localStorage.getItem(SIDEBAR_KEY);
      if (savedSidebar !== null) {
        setSidebarOpen(savedSidebar === "1");
      }
    } catch { /* ignore */ }
    setHistoryLoaded(true);
  }, []);

  // Persist history
  useEffect(() => {
    if (!historyLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch { /* ignore */ }
  }, [history, historyLoaded]);

  // Persist sidebar
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
    } catch { /* ignore */ }
  }, [sidebarOpen]);

  // Count errors in result
  const countErrors = (r: PronunciationResult) =>
    r.words.filter((w) => w.error_type && w.error_type !== "None").length;

  // Generate random text
  const handleRandom = (length?: keyof typeof ALL_TEXTS) => {
    const len = length || textLength;
    const txt = getRandomText(len);
    setReferenceText(txt);
    setResult(null);
    setError("");
    setActiveHistoryId(null);
    speech.reset();
  };

  // Change length
  const handleLengthChange = (len: keyof typeof ALL_TEXTS) => {
    setTextLength(len);
    if (textMode === "random") handleRandom(len);
  };

  // Assess
  const handleAssess = async () => {
    if (!speech.recognizedText || !referenceText.trim()) return;
    setAssessing(true);
    setError("");
    try {
      const { data } = await pronunciationApi.assess(speech.recognizedText, referenceText.trim());
      setResult(data);
      if (data.error) {
        setError(data.error);
      } else {
        // Save to history
        const ec = countErrors(data);
        const newItem: HistoryItem = {
          id: makeId(),
          referenceText: referenceText.trim(),
          recognizedText: speech.recognizedText,
          overallScore: Math.round(data.overall_score),
          errorCount: ec,
          timestamp: Date.now(),
          result: data,
        };
        setHistory((prev) => [newItem, ...prev].slice(0, 50));
        setActiveHistoryId(newItem.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Assessment request failed");
    } finally {
      setAssessing(false);
    }
  };

  const resetAll = () => {
    speech.reset();
    setResult(null);
    setError("");
    setActiveHistoryId(null);
  };

  // Select history record
  const handleSelectHistory = (item: HistoryItem) => {
    setResult(item.result);
    setReferenceText(item.referenceText);
    setActiveHistoryId(item.id);
    speech.reset();
  };

  // Delete history record
  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setResult(null);
    }
  };

  // New assessment
  const handleNewAssessment = () => {
    setResult(null);
    setReferenceText(getRandomText(textLength));
    setActiveHistoryId(null);
    setError("");
    speech.reset();
  };

  // Jump to TTS
  const goToTTS = () => {
    const encoded = encodeURIComponent(referenceText.trim());
    router.push(`/tts?text=${encoded}`);
  };

  return (
    <div className="flex h-full">
      {/* ═══════════════════════════════════════════════
          LEFT SIDEBAR — History Panel
          ═══════════════════════════════════════════════ */}
      <aside
        className={`
          h-full bg-gradient-to-b from-[#1A1D28] via-[#232738] to-[#2A2E3D]
          flex flex-col shrink-0 overflow-hidden transition-all duration-300
          ${sidebarOpen ? "w-72" : "w-0"}
        `}
      >
        <div className="flex-1 overflow-y-auto min-w-[288px]">
          {/* Sidebar Header */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/8">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              历史记录
            </h3>
            {history.length > 0 && (
              <button
                onClick={() => { setHistory([]); setResult(null); setActiveHistoryId(null); }}
                className="text-white/25 hover:text-danger/70 transition-colors"
                title="清空记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* History List */}
          <div className="py-2">
            {history.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MicIcon className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] text-white/25 leading-relaxed">
                  暂无历史记录
                </p>
                <p className="text-[10px] text-white/15 mt-1">
                  完成发音评估后在此显示
                </p>
              </div>
            ) : (
              history.map((item) => {
                const isActive = activeHistoryId === item.id;
                const hasErrors = item.errorCount > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item)}
                    className={`
                      w-full text-left px-4 py-3 transition-all duration-150
                      border-l-2 group
                      ${isActive
                        ? "bg-primary/10 border-l-primary"
                        : "border-l-transparent hover:bg-white/3 hover:border-l-white/15"
                      }
                    `}
                  >
                    <div className="flex items-start gap-2.5">
                      {hasErrors ? (
                        <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-warning" : "text-warning/50"}`} />
                      ) : (
                        <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-success" : "text-success/50"}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed line-clamp-2 whitespace-pre-wrap ${isActive ? "text-white/85" : "text-white/55"} group-hover:text-white/75 transition-colors`}>
                          {item.recognizedText}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold ${isActive ? "text-white/70" : "text-white/35"}`}>
                            {item.overallScore}分
                          </span>
                          {hasErrors && (
                            <span className={`text-[10px] font-medium ${isActive ? "text-warning" : "text-warning/50"}`}>
                              {item.errorCount} 错误
                            </span>
                          )}
                          <span className="text-[10px] text-white/15">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                      {/* Delete button */}
                      <span
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-danger/60 transition-all p-0.5 cursor-pointer"
                        title="删除"
                        role="button"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════
          TOGGLE BUTTON
          ═══════════════════════════════════════════════ */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="shrink-0 w-7 flex items-center justify-center bg-bg-main hover:bg-white/50 transition-colors group"
        title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="w-3.5 h-3.5 text-text-light group-hover:text-text-secondary transition-colors" />
        ) : (
          <PanelLeftOpen className="w-3.5 h-3.5 text-text-light group-hover:text-text-secondary transition-colors" />
        )}
      </button>

      {/* ═══════════════════════════════════════════════
          RIGHT — Main Content Area
          ═══════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto bg-bg-main">
        <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
          {/* ═══ Header ═══ */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">🎯 发音评测 Pronunciation Assessment</h1>
            <p className="text-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
              输入或随机生成一段英文文本，朗读后 AI 进行多维度发音分析
            </p>
            <p className="text-text-light text-xs mt-1 max-w-lg mx-auto">
              Speak the text aloud — AI analyzes accuracy, stress, intonation, rhythm, and more
            </p>
          </div>

          {/* ═══ 文本输入卡片 ═══ */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm mb-6">
            {/* Mode tabs */}
            <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
              <button
                onClick={() => { setTextMode("manual"); setResult(null); setError(""); setActiveHistoryId(null); speech.reset(); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  textMode === "manual" ? "bg-white text-text-primary shadow-sm" : "text-text-light hover:text-text-secondary"
                }`}
              >
                <Pencil className="w-3.5 h-3.5" /> 手动输入
              </button>
              <button
                onClick={() => { setTextMode("random"); handleRandom(); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  textMode === "random" ? "bg-white text-text-primary shadow-sm" : "text-text-light hover:text-text-secondary"
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" /> 随机文本
              </button>
            </div>

            {/* Length selector (only for random) */}
            {textMode === "random" && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-text-light font-medium">长度:</span>
                {(["short", "medium", "long"] as const).map((len) => (
                  <button key={len} onClick={() => handleLengthChange(len)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      textLength === len
                        ? "bg-[#5B4FCF] text-white"
                        : "bg-gray-100 text-text-light hover:bg-gray-200"
                    }`}
                  >
                    {len === "short" ? "短" : len === "medium" ? "中等" : "长"}
                  </button>
                ))}
                <button onClick={() => handleRandom()}
                  className="ml-auto px-3 py-1 rounded-full text-[11px] font-medium text-[#5B4FCF] bg-[#5B4FCF]/10 hover:bg-[#5B4FCF]/20 transition-all flex items-center gap-1">
                  <Shuffle className="w-3 h-3" /> 换一条
                </button>
              </div>
            )}

            {/* Text area */}
            <textarea
              value={referenceText}
              onChange={(e) => { setReferenceText(e.target.value); setResult(null); setActiveHistoryId(null); }}
              rows={textLength === "long" ? 5 : 3}
              placeholder="Enter the text you'll read aloud..."
              className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                         placeholder:text-text-light/60 resize-none focus:outline-none focus:border-[#5B4FCF]/40
                         focus:ring-2 focus:ring-[#5B4FCF]/10 transition-all"
            />
          </div>

          {/* ═══ 录音控制卡片 ═══ */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6">
            {/* "New assessment" button when viewing history */}
            {result && activeHistoryId && (
              <div className="flex justify-end mb-3">
                <button onClick={handleNewAssessment}
                  className="text-xs text-text-light hover:text-primary transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 新评估
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              {!speech.recognizedText && !speech.isListening ? (
                <button onClick={speech.start}
                  className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg
                             bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
                >
                  <Mic className="w-4 h-4" /> 开始朗读 / Start Speaking
                </button>
              ) : speech.isListening ? (
                <button onClick={speech.stop}
                  className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg
                             bg-red-500 animate-pulse shadow-red-200 scale-105 transition-all"
                >
                  <MicOff className="w-4 h-4" /> 停止录音 / Stop
                </button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <button onClick={handleAssess} disabled={assessing}
                    className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white
                               bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-200
                               hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
                    {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                    {assessing ? "AI 分析中..." : "开始评估 / Assess"}
                  </button>
                  <button onClick={resetAll}
                    className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold
                               text-text-secondary bg-white border border-border hover:bg-bg-main transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> 重新朗读 / Retry
                  </button>
                </div>
              )}
            </div>

            {/* Listening status */}
            {speech.isListening && (
              <div className="mt-4 space-y-1">
                <p className="text-center text-xs text-red-500 animate-pulse font-medium">
                  🎤 正在听... 请朗读文本 / Listening... Speak now
                </p>
                {speech.interimText && (
                  <p className="text-center text-xs text-gray-400 italic">{speech.interimText}</p>
                )}
              </div>
            )}

            {/* Recognized text */}
            {speech.recognizedText && !speech.isListening && !assessing && !result && (
              <div className="mt-4 space-y-2">
                <p className="text-center text-xs text-emerald-600 font-medium">
                  ✅ 识别完成！点击「开始评估」/ Recognized! Click &quot;Assess&quot;
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">🎙️ 识别结果 / What you said:</p>
                  <p className="text-sm text-emerald-800">{speech.recognizedText}</p>
                </div>
              </div>
            )}

            {/* History indicator */}
            {result && activeHistoryId && (
              <div className="mt-4">
                <span className="text-[10px] text-text-light/60 bg-bg-main px-2 py-1 rounded-md">
                  历史查看
                </span>
              </div>
            )}
          </div>

          {/* ═══ Error ═══ */}
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-800 text-sm font-semibold">评估提示 / Notice</p>
                <p className="text-amber-600 text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ════════════ 结果展示 ════════════ */}
          {result && (
            <div className="space-y-6 animate-fade-in">
              {/* ─── 综合分数 + 维度评分 ─── */}
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-[#5B4FCF]" /> 评分总览 / Score Overview
                </h2>

                <div className="grid sm:grid-cols-3 gap-6">
                  {/* Overall ring */}
                  <div className="flex flex-col items-center justify-center">
                    <ScoreRing score={result.overall_score} label="综合分" size={96} />
                  </div>

                  {/* Dimension bars */}
                  <div className="sm:col-span-2 space-y-3">
                    <DimBar label="准确度 Accuracy" score={result.accuracy_score} 
                      icon={<Target className="w-3 h-3" />} color="#6366f1" />
                    <DimBar label="流利度 Fluency" score={result.fluency_score}
                      icon={<Zap className="w-3 h-3" />} color="#f59e0b" />
                    <DimBar label="完整度 Completeness" score={result.completeness_score}
                      icon={<CheckCircle2 className="w-3 h-3" />} color="#10b981" />
                    <DimBar label="重音语调 Stress" score={result.stress_score}
                      icon={<Volume2 className="w-3 h-3" />} color="#ef4444" />
                    <DimBar label="语音语调 Intonation" score={result.intonation_score}
                      icon={<TrendingUp className="w-3 h-3" />} color="#8b5cf6" />
                    <DimBar label="节奏感 Rhythm" score={result.rhythm_score}
                      icon={<Zap className="w-3 h-3" />} color="#06b6d4" />
                  </div>
                </div>
              </div>

              {/* ─── AI 分析总结 ─── */}
              {(result.summary_en || result.summary_cn) && (
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> AI 分析 / Analysis
                  </h2>
                  {result.summary_en && (
                    <p className="text-text-secondary text-sm leading-relaxed">{result.summary_en}</p>
                  )}
                  {result.summary_cn && (
                    <p className="text-text-light text-xs leading-relaxed mt-2 pt-2 border-t border-border/50">
                      {result.summary_cn}
                    </p>
                  )}
                </div>
              )}

              {/* ─── 音素突出点 ─── */}
              {result.phoneme_highlights.length > 0 && (
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
                    <Volume2 className="w-4 h-4 text-blue-500" /> 音素重点 / Phoneme Highlights
                  </h2>
                  <div className="space-y-2">
                    {result.phoneme_highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <span className="text-blue-500 mt-0.5 shrink-0">🔹</span>
                        <p className="text-xs text-blue-800 leading-relaxed">{h}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── 逐词分析 ─── */}
              {result.words.length > 0 && (
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
                    <Pencil className="w-4 h-4 text-[#5B4FCF]" /> 逐词分析 / Word-by-Word Analysis
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {result.words.map((w, i) => (
                      <WordErrorCard key={i} w={w} />
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex justify-center gap-5 mt-4 pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5 text-[10px] text-text-light">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 正确
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-text-light">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 一般
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-text-light">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 需纠正
                    </span>
                  </div>
                </div>
              )}

              {/* ─── 学习建议 ─── */}
              {result.suggestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> 学习建议 / Suggestions
                  </h2>
                  <ul className="space-y-2">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                        <span className="font-bold text-amber-500 mt-0.5 shrink-0">{i + 1}.</span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── 跳转到 TTS ─── */}
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm text-center">
                <p className="text-text-secondary text-sm mb-3">
                  想听一下标准的正确发音吗？ / Want to hear the correct pronunciation?
                </p>
                <button onClick={goToTTS}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white
                             bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-md shadow-indigo-200
                             hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  <Volume2 className="w-4 h-4" />
                  听标准发音 / Listen to Correct Pronunciation
                </button>
              </div>

              {/* ─── 重新评估 ─── */}
              <div className="text-center pb-8">
                <button onClick={resetAll}
                  className="text-sm text-text-light hover:text-[#5B4FCF] transition-colors underline">
                  ← 重新评估 / Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════ 时间格式化 ═══════════════════ */

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
