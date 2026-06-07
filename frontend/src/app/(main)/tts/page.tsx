"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Volume2, Loader2, Play, Pause, Download, PanelLeftClose,
  PanelLeftOpen, Trash2, Music, Gauge, Sparkles, Copy,
  CheckCircle2, AlertCircle, Zap, Clock, Type, Hash
} from "lucide-react";
import { ttsApi, TTSResult, TTSVoice } from "@/lib/api";

/* ═══════════════════ 音频播放工具 ═══════════════════ */

function playBase64Audio(
  base64: string,
  format = "mp3",
  onEnd?: () => void,
): { audio: HTMLAudioElement; promise: Promise<void> } {
  const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
  const audio = new Audio(`data:${mime};base64,${base64}`);
  audio.onended = () => onEnd?.();
  audio.onerror = () => onEnd?.();
  const promise = audio.play().then(() => {}).catch(() => onEnd?.());
  return { audio, promise };
}

function downloadBase64Audio(base64: string, format = "mp3", filename = "tts-audio") {
  const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const byteArr = new Uint8Array(byteNums);
  const blob = new Blob([byteArr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════ 历史记录类型 ═══════════════════ */

interface HistoryItem {
  id: string;
  text: string;
  provider: string;
  voice: string;
  voiceLabel: string;
  format: string;
  audioBase64: string;
  timestamp: number;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ═══════════════════ 示例文本 ═══════════════════ */

const SAMPLE_TEXTS = [
  "Hello, welcome to AI English Trainer! Let's practice speaking together.",
  "The weather is beautiful today. I think I'll go for a walk in the park.",
  "Could you tell me how to get to the nearest subway station?",
  "I've been learning English for three years, and I'm making great progress.",
  "Would you like a cup of coffee or tea? I can make either one for you.",
  "Technology has changed the way we communicate with each other.",
  "The most important thing is to never give up on your dreams.",
  "Nice to meet you! My name is Alex, and I'm a software engineer.",
];

/* ═══════════════════ 主页面 ═══════════════════ */

export default function TTSPage() {
  const searchParams = useSearchParams();
  const [text, setText] = useState("");

  // Read text from URL query param (for pronunciation page jump)
  useEffect(() => {
    const textParam = searchParams.get("text");
    if (textParam) {
      setText(decodeURIComponent(textParam));
    }
  }, [searchParams]);

  // Provider & voice state
  const [provider, setProvider] = useState("edge");
  const [voice, setVoice] = useState("default");
  const [rate, setRate] = useState(1.0);
  const [allVoices, setAllVoices] = useState<Record<string, TTSVoice[]>>({});
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Playback state
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<TTSResult | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const STORAGE_KEY = "tts_history_v1";
  const SIDEBAR_KEY = "tts_sidebar_v1";

  /* ── Load voices from API ── */
  useEffect(() => {
    ttsApi.getVoices().then(({ data }) => {
      setAllVoices(data.voices);
      setVoicesLoaded(true);
    }).catch(() => setVoicesLoaded(true));
  }, []);

  /* ── localStorage persistence ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setHistory(parsed);
      }
      const savedSidebar = localStorage.getItem(SIDEBAR_KEY);
      if (savedSidebar !== null) setSidebarOpen(savedSidebar === "1");
    } catch { /* ignore */ }
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50))); } catch {}
  }, [history, historyLoaded]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0"); } catch {}
  }, [sidebarOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      activeAudioRef.current?.pause();
      activeAudioRef.current = null;
    };
  }, []);

  /* ── Computed: filtered voices for current provider ── */
  const providerVoices = allVoices[provider] || [];
  const hasVoicesForProvider = providerVoices.length > 0;

  // When switching provider, reset voice to first available
  useEffect(() => {
    if (!voicesLoaded) return;
    if (provider === "edge" || provider === "azure") {
      const voices = allVoices[provider] || [];
      if (voices.length > 0) {
        const currentValid = voices.find((v) => v.key === voice);
        if (!currentValid) setVoice(voices[0].key);
      } else {
        setVoice("default");
      }
    } else if (provider === "openai") {
      const voices = allVoices.openai || [];
      if (voices.length > 0) {
        const currentValid = voices.find((v) => v.key === voice);
        if (!currentValid) setVoice(voices[0].key);
      }
    }
  }, [provider, voicesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Text stats ── */
  const trimmedText = text.trim();
  const charCount = trimmedText.length;
  const wordCount = trimmedText ? trimmedText.split(/\s+/).filter(Boolean).length : 0;
  // Rough estimate: ~150 words per minute at normal speed
  const estDuration = rate > 0 ? Math.max(1, Math.round((wordCount / 150) * 60 / rate)) : 0;

  /* ── Handlers ── */

  const handleSpeak = async () => {
    if (!trimmedText) return;

    // Stop any playing audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
      setPlaying(false);
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await ttsApi.speak(trimmedText, voice, provider, rate);
      setLastResult(data);

      // Play audio
      const { audio } = playBase64Audio(data.audio_base64, data.format, () => {
        setPlaying(false);
        activeAudioRef.current = null;
      });
      activeAudioRef.current = audio;
      setPlaying(true);

      // Save to history
      const voiceLabel = getVoiceLabel(data.voice, provider, allVoices);
      const newItem: HistoryItem = {
        id: makeId(),
        text: trimmedText.slice(0, 200),
        provider: data.provider,
        voice: data.voice,
        voiceLabel,
        format: data.format,
        audioBase64: data.audio_base64,
        timestamp: Date.now(),
      };
      setHistory((prev) => [newItem, ...prev].slice(0, 50));
      setActiveHistoryId(newItem.id);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "TTS synthesis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStopPlayback = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setPlaying(false);
  };

  const handleReplay = (base64: string, format: string) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    const { audio } = playBase64Audio(base64, format, () => {
      setPlaying(false);
      activeAudioRef.current = null;
    });
    activeAudioRef.current = audio;
    setPlaying(true);
  };

  const handleDownload = () => {
    if (!lastResult) return;
    downloadBase64Audio(lastResult.audio_base64, lastResult.format, "tts-speech");
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveHistoryId(item.id);
    setText(item.text);
    setLastResult({
      audio_base64: item.audioBase64,
      format: item.format,
      voice: item.voice,
      provider: item.provider,
    });
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
      setPlaying(false);
    }
  };

  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setLastResult(null);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
        setPlaying(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSpeak();
    }
  };

  const handleSampleText = (sample: string) => {
    setText(sample);
    setLastResult(null);
    setActiveHistoryId(null);
    setError("");
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
      setPlaying(false);
    }
  };

  const handleNewSynthesis = () => {
    setLastResult(null);
    setActiveHistoryId(null);
    setError("");
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
      setPlaying(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(trimmedText).catch(() => {});
  };

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="flex h-full">
      {/* ═══════ LEFT SIDEBAR — History Panel ═══════ */}
      <aside
        className={`h-full bg-gradient-to-b from-[#1A1D28] via-[#232738] to-[#2A2E3D] flex flex-col shrink-0 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="flex-1 overflow-y-auto min-w-[288px]">
          {/* Sidebar Header */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/8">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              合成历史
            </h3>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([]);
                  setLastResult(null);
                  setActiveHistoryId(null);
                }}
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
                <Music className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] text-white/25 leading-relaxed">
                  暂无合成历史
                </p>
                <p className="text-[10px] text-white/15 mt-1">
                  朗读文本后将在此显示
                </p>
              </div>
            ) : (
              history.map((item) => {
                const isActive = activeHistoryId === item.id;
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
                      <Volume2
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          isActive ? "text-primary-light" : "text-white/30"
                        } group-hover:text-white/50 transition-colors`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-relaxed line-clamp-2 whitespace-pre-wrap ${
                            isActive ? "text-white/85" : "text-white/55"
                          } group-hover:text-white/75 transition-colors`}
                        >
                          {item.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`text-[10px] font-medium ${
                              isActive ? "text-white/70" : "text-white/35"
                            }`}
                          >
                            {item.voiceLabel}
                          </span>
                          <span className="text-[10px] text-white/20">
                            {item.provider}
                          </span>
                          <span className="text-[10px] text-white/15">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-danger/60 transition-all p-0.5"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B4FCF]/20 to-[#7C6FF7]/20 flex items-center justify-center mx-auto mb-4">
              <Volume2 className="w-8 h-8 text-[#5B4FCF]" />
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              🔊 语音合成 TTS
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              输入英文文本，AI 将使用自然语音朗读 — 支持 Edge / Azure / OpenAI
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
            {/* "New synthesis" when viewing history */}
            {lastResult && activeHistoryId && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={handleNewSynthesis}
                  className="text-xs text-text-light hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> 新合成
                </button>
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setLastResult(null);
                setActiveHistoryId(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter English text to speak...&#10;e.g. Hello, welcome to AI English Trainer!"
              rows={4}
              className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                         placeholder:text-text-light/60 resize-none focus:outline-none focus:border-primary/40
                         focus:ring-2 focus:ring-primary/10 transition-all"
            />

            {/* Sample texts */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-text-light font-medium shrink-0">
                快速示例:
              </span>
              {SAMPLE_TEXTS.slice(0, 4).map((sample, i) => (
                <button
                  key={i}
                  onClick={() => handleSampleText(sample)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium text-text-light
                             bg-gray-100 hover:bg-[#5B4FCF]/10 hover:text-[#5B4FCF] transition-colors
                             truncate max-w-[180px]"
                  title={sample}
                >
                  {sample.length > 25 ? sample.slice(0, 25) + "…" : sample}
                </button>
              ))}
            </div>

            {/* Controls row */}
            <div className="mt-4 space-y-3">
              {/* Provider + Voice + Rate */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Provider */}
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                             focus:outline-none focus:border-primary/40 cursor-pointer"
                >
                  <option value="edge">Edge TTS (免费)</option>
                  <option value="azure">Azure TTS</option>
                  <option value="openai">OpenAI TTS</option>
                </select>

                {/* Voice */}
                {hasVoicesForProvider ? (
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                               focus:outline-none focus:border-primary/40 cursor-pointer max-w-[200px]"
                  >
                    <option value="default">默认声音</option>
                    {providerVoices.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                               focus:outline-none focus:border-primary/40 cursor-pointer"
                  >
                    <option value="default">默认声音</option>
                  </select>
                )}
              </div>

              {/* Rate slider */}
              <div className="flex items-center gap-3">
                <Gauge className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[10px] text-text-light font-medium w-10 shrink-0">
                  语速 {rate.toFixed(1)}x
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-[#5B4FCF] [&::-webkit-slider-thumb]:shadow-md
                             [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                             [&::-webkit-slider-thumb]:hover:scale-110"
                  style={{
                    background: `linear-gradient(to right, #5B4FCF ${((rate - 0.5) / 1.5) * 100}%, #e5e7eb ${((rate - 0.5) / 1.5) * 100}%)`,
                  }}
                />
              </div>
            </div>

            {/* Text stats + actions */}
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              {/* Text stats */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-text-light">
                  <Type className="w-3 h-3" />
                  {charCount} 字符
                </span>
                <span className="flex items-center gap-1 text-[10px] text-text-light">
                  <Hash className="w-3 h-3" />
                  {wordCount} 单词
                </span>
                {wordCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-text-light">
                    <Clock className="w-3 h-3" />
                    ~{estDuration}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {trimmedText && (
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                               bg-gray-100 text-text-secondary hover:bg-[#5B4FCF]/10 hover:text-[#5B4FCF]
                               transition-colors"
                    title="复制文本"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Speak / Stop button */}
                {playing ? (
                  <button
                    onClick={handleStopPlayback}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                               bg-red-500 shadow-md shadow-red-200 animate-pulse
                               hover:bg-red-600 transition-all duration-200"
                  >
                    <Pause className="w-4 h-4" />
                    停止播放
                  </button>
                ) : (
                  <button
                    onClick={handleSpeak}
                    disabled={loading || !trimmedText}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                               bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-md shadow-indigo-500/25
                               hover:shadow-lg hover:shadow-indigo-500/35 hover:-translate-y-0.5
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
                               transition-all duration-200"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {loading ? "生成中..." : "朗读"}
                  </button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-800 text-xs font-semibold mb-0.5">合成失败 / Synthesis Failed</p>
                  <p className="text-red-600 text-[11px] leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* ═══════ Result Card ═══════ */}
          {lastResult && (
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm animate-slide-up mb-6">
              {/* Status Badge + History indicator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs font-semibold text-success">合成完成</span>
                </div>
                {activeHistoryId && (
                  <span className="text-[10px] text-text-light/60 bg-bg-main px-2 py-1 rounded-md">
                    历史查看
                  </span>
                )}
              </div>

              {/* Text preview */}
              <div className="mb-4 p-4 rounded-xl bg-bg-main border border-border">
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-1.5">
                  朗读文本
                </p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                  {trimmedText}
                </p>
              </div>

              {/* Info badges */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#5B4FCF]/8 border border-[#5B4FCF]/15 text-[10px] font-medium text-[#5B4FCF]">
                  {lastResult.provider}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 border border-border text-[10px] font-medium text-text-secondary">
                  <Volume2 className="w-3 h-3" />
                  {getVoiceLabel(lastResult.voice, lastResult.provider, allVoices)}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 border border-border text-[10px] font-medium text-text-secondary">
                  {lastResult.format.toUpperCase()}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => handleReplay(lastResult.audio_base64, lastResult.format)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-200
                    ${playing
                      ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                      : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:-translate-y-0.5"
                    }`}
                >
                  {playing ? (
                    <>
                      <Pause className="w-4 h-4" />
                      停止播放
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      重新播放
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border
                             text-sm font-medium text-text-secondary hover:bg-bg-main hover:-translate-y-0.5
                             transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  下载音频
                </button>

                <button
                  onClick={handleNewSynthesis}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium
                             text-text-light hover:text-text-secondary transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  新合成
                </button>
              </div>
            </div>
          )}

          {/* Empty state hint */}
          {!lastResult && !loading && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
                <Music className="w-10 h-10 text-text-light/40" />
              </div>
              <p className="text-text-light text-sm">
                输入文本并点击「朗读」，即可听到 AI 语音合成
              </p>
              <p className="text-text-light/60 text-xs mt-1">
                Type text and click &quot;Speak&quot; to generate speech
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════ 辅助函数 ═══════════════════ */

function getVoiceLabel(
  voiceKey: string,
  provider: string,
  allVoices: Record<string, TTSVoice[]>,
): string {
  const voices = allVoices[provider] || [];
  const found = voices.find((v) => v.key === voiceKey);
  if (found) return found.name;
  // Fallback: prettify OpenAI voice names
  if (provider === "openai") return voiceKey.charAt(0).toUpperCase() + voiceKey.slice(1);
  return voiceKey;
}

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
