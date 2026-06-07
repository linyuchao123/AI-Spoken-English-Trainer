"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Copy, Trash2, Volume2, PanelLeftClose, PanelLeftOpen,
  Loader2, Sparkles, BarChart3, Edit3, Check, ArrowRight, X,
} from "lucide-react";
import { ttsApi } from "@/lib/api";

/* ═══════════════════ Helpers ═══════════════════ */

const LANGS = [
  { key: "en-US", label: "🇺🇸 English" },
  { key: "en-GB", label: "🇬🇧 English (UK)" },
  { key: "zh-CN", label: "🇨🇳 中文" },
  { key: "ja-JP", label: "🇯🇵 日本語" },
] as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ═══════════════════ Types ═══════════════════ */

interface HistoryItem {
  id: string;
  text: string;
  lang: string;
  langLabel: string;
  timestamp: number;
}

interface TextStats {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  readDuration: number;
  speakDuration: number;
}

function calcStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/) : [];
  return {
    wordCount: words.length,
    charCount: trimmed.length,
    charCountNoSpaces: trimmed.replace(/\s/g, "").length,
    readDuration: Math.max(1, Math.round(words.length / 2.5)),
    speakDuration: Math.max(1, Math.round(words.length / 2.17)),
  };
}

/* ═══════════════════ Error Messages ═══════════════════ */

const ERROR_MESSAGES: Record<string, { title: string; desc: string }> = {
  network: {
    title: "语音识别服务连接失败",
    desc: "Web Speech API 需连接 Google 服务器，在中国大陆可能无法使用。建议：开启代理 / VPN，或手动输入文字后使用其他功能。",
  },
  "not-allowed": {
    title: "麦克风权限被拒绝",
    desc: "请在浏览器设置中允许使用麦克风，然后刷新页面重试。",
  },
  "audio-capture": {
    title: "未检测到麦克风",
    desc: "请确认已连接麦克风设备，并授予浏览器麦克风访问权限。",
  },
  "service-not-available": {
    title: "语音识别服务不可用",
    desc: "当前浏览器不支持语音识别，请使用 Chrome 或 Edge。",
  },
};

/* ═══════════════════ Speech Recognition Hook ═══════════════════ */

function useSpeechRecognition(lang: string) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const shouldRestart = useRef(false);
  const finalText = useRef("");
  const langRef = useRef(lang);

  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setIsSupported(false); return; }
    setIsSupported(true);

    const rec = new SR();
    rec.lang = langRef.current;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText.current += " " + e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setFinalTranscript(finalText.current.trim());
      setInterimTranscript(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error);
      setIsListening(false);
    };
    rec.onend = () => {
      if (shouldRestart.current) {
        try { rec.start(); } catch { /* */ }
      } else setIsListening(false);
    };
    recognitionRef.current = rec;
    return () => { shouldRestart.current = false; try { rec.stop(); } catch { /* */ } };
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current; if (!rec) return;
    shouldRestart.current = true; finalText.current = "";
    setFinalTranscript(""); setInterimTranscript(""); setError("");
    setIsListening(true);
    try { rec.lang = langRef.current; rec.start(); } catch { /* */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current; if (!rec) return;
    shouldRestart.current = false; setIsListening(false);
    try { rec.stop(); } catch { /* */ }
  }, []);

  const clearError = useCallback(() => setError(""), []);

  return { isListening, isSupported, finalTranscript, interimTranscript, error, start, stop, clearError };
}

/* ═══════════════════ Stat Badge ═══════════════════ */

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5">
      <span className="text-[10px] text-text-light/60">{label}</span>
      <span className="text-sm font-bold text-text-secondary">{value}</span>
    </div>
  );
}

/* ═══════════════════ Main Page ═══════════════════ */

const STORAGE_KEY = "asr_history_v1";
const SIDEBAR_KEY = "asr_sidebar_v1";

export default function ASRPage() {
  const [lang, setLang] = useState("en-US");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [manualText, setManualText] = useState("");

  const speech = useSpeechRecognition(lang);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);

  const displayText = isEditing
    ? editText
    : activeHistoryId
      ? history.find((h) => h.id === activeHistoryId)?.text ?? ""
      : speech.finalTranscript;

  const stats = calcStats(displayText || manualText || "");

  // ── localStorage persistence ──

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setHistory(parsed);
      }
      const savedSidebar = localStorage.getItem(SIDEBAR_KEY);
      if (savedSidebar !== null) setSidebarOpen(savedSidebar === "1");
    } catch { /* */ }
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50))); } catch {}
  }, [history, historyLoaded]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0"); } catch {}
  }, [sidebarOpen]);

  // ── Handlers ──

  const handleStopAndSave = () => {
    speech.stop();
    const text = `${speech.finalTranscript} ${speech.interimTranscript}`.trim();
    if (!text) return;
    saveToHistory(text);
  };

  const saveToHistory = (text: string) => {
    const langLabel = LANGS.find((l) => l.key === lang)?.label ?? lang;
    const newItem: HistoryItem = {
      id: makeId(),
      text,
      lang,
      langLabel,
      timestamp: Date.now(),
    };
    setHistory((prev) => [newItem, ...prev].slice(0, 50));
    setActiveHistoryId(newItem.id);
    setEditText(text);
    setIsEditing(false);
    setManualText("");
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveHistoryId(item.id);
    setEditText(item.text);
    setIsEditing(false);
    setLang(item.lang);
    setManualText("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  };

  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setEditText("");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // ── TTS Replay ──

  const handleReplay = async (text: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === id) { setPlayingId(null); return; }

    setPlayingId(id);
    try {
      const { data } = await ttsApi.speak(text);
      const binary = atob(data.audio_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: `audio/${data.format}` });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  };

  // ── Edit ──

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const finishEditing = () => {
    setIsEditing(false);
    if (activeHistoryId && editText.trim()) {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === activeHistoryId ? { ...h, text: editText.trim() } : h,
        ),
      );
    }
  };

  // ── Manual input fallback (for network error) ──

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    saveToHistory(manualText.trim());
  };

  // ── Jump ──

  const handleJumpGrammar = () => {
    const text = editText || displayText || manualText;
    if (text) router.push(`/grammar?text=${encodeURIComponent(text.trim())}`);
  };

  const handleJumpPronunciation = () => {
    const text = editText || displayText || manualText;
    if (text) router.push(`/pronunciation?text=${encodeURIComponent(text.trim())}`);
  };

  // Determine error info
  const errorInfo = speech.error ? (ERROR_MESSAGES[speech.error] || { title: `错误: ${speech.error}`, desc: "请重试。" }) : null;

  return (
    <div className="flex h-full">
      {/* ═══════ LEFT SIDEBAR — History Panel ═══════ */}
      <aside
        className={`h-full bg-gradient-to-b from-[#1A1D28] via-[#232738] to-[#2A2E3D] flex flex-col shrink-0 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="flex-1 overflow-y-auto min-w-[288px]">
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/8">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              识别历史
            </h3>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([]);
                  setActiveHistoryId(null);
                  setEditText("");
                }}
                className="text-white/25 hover:text-danger/70 transition-colors"
                title="清空记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="py-2">
            {history.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Mic className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] text-white/25 leading-relaxed">
                  暂无识别记录
                </p>
                <p className="text-[10px] text-white/15 mt-1">
                  点击麦克风开始录音
                </p>
              </div>
            ) : (
              history.map((item) => {
                const isActive = activeHistoryId === item.id;
                const isPlaying = playingId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item)}
                    className={`w-full text-left px-4 py-3 transition-all duration-150 border-l-2 group
                      ${
                        isActive
                          ? "bg-primary/10 border-l-primary"
                          : "border-l-transparent hover:bg-white/3 hover:border-l-white/15"
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-relaxed line-clamp-2 ${
                            isActive ? "text-white/85" : "text-white/55"
                          } group-hover:text-white/75 transition-colors`}
                        >
                          {item.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-white/30">
                            {item.langLabel}
                          </span>
                          <span className="text-[10px] text-white/15">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReplay(item.text, item.id);
                          }}
                          className={`p-1 rounded cursor-pointer ${
                            isPlaying
                              ? "text-[#5B4FCF]"
                              : "text-white/20 hover:text-white/60"
                          } transition-colors`}
                          title="朗读"
                          role="button"
                        >
                          <Volume2 className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          className="p-1 rounded text-white/20 hover:text-danger/60 transition-colors cursor-pointer"
                          title="删除"
                          role="button"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* ═══════ TOGGLE ═══════ */}
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

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="flex-1 overflow-y-auto bg-bg-main">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {/* Header */}
          <div className="text-center mb-8 animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400/20 to-rose-600/20 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              🎤 语音识别 ASR
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              浏览器内置 Web Speech API · 免费实时转写 · 推荐 Chrome / Edge
            </p>
          </div>

          {/* Language Selector */}
          <div className="flex justify-center gap-2 mb-6">
            {LANGS.map((l) => (
              <button
                key={l.key}
                onClick={() => { setLang(l.key); setIsEditing(false); speech.clearError(); }}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  lang === l.key
                    ? "bg-[#5B4FCF] text-white shadow-md shadow-indigo-200"
                    : "bg-white border border-border text-text-secondary hover:border-[#5B4FCF]/30"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {!speech.isSupported ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center animate-fade-in">
              <p className="text-amber-800 text-sm font-semibold mb-1">
                ⚠️ 浏览器不支持
              </p>
              <p className="text-amber-600 text-xs">
                请使用 Chrome 或 Edge 浏览器进行语音识别，Firefox / Safari 支持有限。
              </p>
            </div>
          ) : (
            <>
              {/* ── Record Card ── */}
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
                <div className="flex flex-col items-center gap-6">
                  {/* Big Mic Button */}
                  <button
                    onClick={speech.isListening ? handleStopAndSave : speech.start}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-500 ${
                      speech.isListening
                        ? "bg-red-500 animate-pulse shadow-red-300 scale-110"
                        : "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-300 hover:scale-105 active:scale-95"
                    }`}
                  >
                    {speech.isListening ? (
                      <MicOff className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>

                  {/* Status */}
                  <div className="text-center">
                    {speech.isListening ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="text-sm font-semibold text-red-500">
                          正在录音...
                        </span>
                      </div>
                    ) : displayText ? (
                      <span className="text-xs text-text-light">
                        点击麦克风重新录音
                      </span>
                    ) : (
                      <span className="text-sm text-text-light">
                        点击麦克风开始说话
                      </span>
                    )}
                  </div>
                </div>

                {/* Transcript / Edit Area */}
                <div className="mt-6 min-h-[80px] p-4 bg-bg-main rounded-xl border border-border/50">
                  {speech.isListening ? (
                    <p className="text-text-primary text-lg leading-relaxed">
                      {speech.finalTranscript}
                      {speech.interimTranscript && (
                        <span className="text-text-light italic">
                          {" "}
                          {speech.interimTranscript}
                        </span>
                      )}
                    </p>
                  ) : isEditing ? (
                    <textarea
                      ref={editRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full bg-transparent text-text-primary text-lg leading-relaxed resize-none
                                 focus:outline-none placeholder:text-text-light/40"
                      placeholder="编辑识别结果..."
                    />
                  ) : displayText ? (
                    <p className="text-text-primary text-lg leading-relaxed whitespace-pre-wrap">
                      {displayText}
                    </p>
                  ) : (
                    <p className="text-text-light/40 text-sm italic">
                      识别结果将在此显示...
                    </p>
                  )}
                </div>

                {/* ── Error Display ── */}
                {errorInfo && (
                  <div className="mt-4 bg-danger/5 border border-danger/20 rounded-xl p-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-danger">{errorInfo.title}</p>
                        <p className="text-xs text-danger/70 mt-1.5 leading-relaxed">{errorInfo.desc}</p>
                        {speech.error === "network" && (
                          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-border/50">
                            <p className="text-xs font-medium text-text-secondary mb-2">
                              💡 手动输入替代方案（语音不可用时）
                            </p>
                            <textarea
                              ref={manualRef}
                              value={manualText}
                              onChange={(e) => setManualText(e.target.value)}
                              rows={2}
                              placeholder="在此手动输入英文文本，提交后可进行语法纠错、发音评测等操作..."
                              className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                                         placeholder:text-text-light/50 resize-none focus:outline-none focus:border-primary/40"
                            />
                            {manualText.trim() && (
                              <div className="flex gap-2 mt-2">
                                <button onClick={handleManualSubmit}
                                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold
                                             bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white shadow-sm
                                             hover:shadow-md transition-all">
                                  <Check className="w-3 h-3" /> 提交
                                </button>
                                <button onClick={handleJumpGrammar}
                                  disabled={!manualText.trim()}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                                             border border-[#5B4FCF]/20 text-[#5B4FCF] hover:bg-[#5B4FCF]/5 transition-colors
                                             disabled:opacity-40">
                                  <Sparkles className="w-3 h-3" /> 语法纠错
                                </button>
                                <button onClick={handleJumpPronunciation}
                                  disabled={!manualText.trim()}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                                             border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5 transition-colors
                                             disabled:opacity-40">
                                  <Mic className="w-3 h-3" /> 发音评测
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button onClick={() => speech.clearError()}
                        className="text-danger/40 hover:text-danger/70 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── After Recording: Stats + Actions ── */}
              {displayText && !speech.isListening && (
                <div className="animate-fade-in space-y-4">
                  {/* Statistics */}
                  <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-text-light" />
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        文本统计 Text Stats
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <StatBadge label="词数 Words" value={stats.wordCount} />
                      <div className="w-px h-8 bg-border" />
                      <StatBadge label="含空格" value={stats.charCount} />
                      <div className="w-px h-8 bg-border" />
                      <StatBadge label="无空格" value={stats.charCountNoSpaces} />
                      <div className="w-px h-8 bg-border" />
                      <StatBadge label="朗读≈" value={`${stats.readDuration}s`} />
                      <div className="w-px h-8 bg-border" />
                      <StatBadge label="口语≈" value={`${stats.speakDuration}s`} />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {/* Edit / Done */}
                    {isEditing ? (
                      <button
                        onClick={finishEditing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                                   bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> 完成编辑
                      </button>
                    ) : (
                      <button
                        onClick={startEditing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                                   bg-bg-main border border-border text-text-secondary hover:border-[#5B4FCF]/30 hover:text-[#5B4FCF] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> 编辑
                      </button>
                    )}

                    {/* Copy */}
                    <button
                      onClick={() => handleCopy(editText || displayText)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                                 bg-bg-main border border-border text-text-secondary hover:border-[#5B4FCF]/30 hover:text-[#5B4FCF] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />{" "}
                      {copied ? "已复制!" : "复制"}
                    </button>

                    {/* TTS Play */}
                    <button
                      onClick={() =>
                        handleReplay(
                          editText || displayText,
                          activeHistoryId || "current",
                        )
                      }
                      disabled={!displayText}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                        playingId === (activeHistoryId || "current")
                          ? "bg-[#5B4FCF]/10 border border-[#5B4FCF]/30 text-[#5B4FCF]"
                          : "bg-bg-main border border-border text-text-secondary hover:border-[#5B4FCF]/30 hover:text-[#5B4FCF]"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Volume2
                        className={`w-3.5 h-3.5 ${
                          playingId === (activeHistoryId || "current")
                            ? "animate-pulse"
                            : ""
                        }`}
                      />
                      {playingId === (activeHistoryId || "current")
                        ? "播放中..."
                        : "朗读"}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 bg-border/50 hidden sm:block" />

                    {/* Jump: Grammar */}
                    <button
                      onClick={handleJumpGrammar}
                      disabled={!displayText}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                                 bg-gradient-to-r from-[#5B4FCF]/10 to-[#7C6FF7]/10 border border-[#5B4FCF]/20
                                 text-[#5B4FCF] hover:bg-[#5B4FCF]/20 transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 语法纠错
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    {/* Jump: Pronunciation */}
                    <button
                      onClick={handleJumpPronunciation}
                      disabled={!displayText}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                                 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20
                                 text-emerald-600 hover:bg-emerald-500/20 transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Mic className="w-3.5 h-3.5" /> 发音评测
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
