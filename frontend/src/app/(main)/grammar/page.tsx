"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles, AlertCircle, CheckCircle2, ArrowRight, Loader2,
  PanelLeftClose, PanelLeftOpen, Trash2, MessageSquareText,
  Mic, MicOff, Upload, FileText, ImageIcon, Star, Lightbulb
} from "lucide-react";
import {
  grammarApi, GrammarResult, GrammarErrorItem, ExpressionImprovementItem,
  Model, scenesApi
} from "@/lib/api";

const ERROR_TYPE_LABELS: Record<string, string> = {
  grammar: "语法", vocabulary: "词汇", word_order: "语序",
  preposition: "介词", article: "冠词", tense: "时态",
  spelling: "拼写", punctuation: "标点",
};

// ── Types ────────────────────────────────────────────────────
interface HistoryItem {
  id: string;
  original: string;
  hasErrors: boolean;
  errorCount: number;
  timestamp: number;
  modelName: string;
  result: GrammarResult;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Speech Recognition Hook ── */
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

/* ═══════════════════════ 主页面 ═══════════════════════ */

export default function GrammarPage() {
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  
  // Read ?text= from URL on mount
  useEffect(() => {
    const paramText = searchParams.get("text");
    if (paramText && !text) setText(paramText);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState("");

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const speech = useSpeechRecognition();

  const STORAGE_KEY = "grammar_history_v1";
  const SIDEBAR_KEY = "grammar_sidebar_v1";

  // Load models
  useEffect(() => {
    scenesApi.getConfig().then(({ data }) => {
      setModels(data.models);
      if (data.models.length > 0) setSelectedModel(data.models[0].key);
    }).catch(() => {});
  }, []);

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

  // ── Handlers ──────────────────────────────────────────────

  const handleCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await grammarApi.correct(text.trim(), selectedModel);
      setResult(data);
      const modelName = models.find((m) => m.key === selectedModel)?.name ?? selectedModel;
      const newItem: HistoryItem = {
        id: makeId(),
        original: data.original,
        hasErrors: data.has_errors,
        errorCount: data.errors.length,
        timestamp: Date.now(),
        modelName,
        result: data,
      };
      setHistory((prev) => [newItem, ...prev].slice(0, 50));
      setActiveHistoryId(newItem.id);
      setText("");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Grammar check failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCheck();
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setResult(item.result);
    setText(item.original);
    setActiveHistoryId(item.id);
  };

  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setResult(null);
    }
  };

  const handleNewCheck = () => {
    setResult(null);
    setText("");
    setActiveHistoryId(null);
    setError("");
  };

  // ── File upload ──
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const { data } = await grammarApi.extractText(file);
      setText((prev) => prev ? prev + "\n" + data.text : data.text);
      setResult(null);
      setActiveHistoryId(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to extract text from file.");
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (e.target) e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* ═══════ LEFT SIDEBAR — History Panel ═══════ */}
      <aside className={`h-full bg-gradient-to-b from-[#1A1D28] via-[#232738] to-[#2A2E3D] flex flex-col shrink-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? "w-72" : "w-0"}`}>
        <div className="flex-1 overflow-y-auto min-w-[288px]">
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/8">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">历史记录</h3>
            {history.length > 0 && (
              <button onClick={() => { setHistory([]); setResult(null); setActiveHistoryId(null); }}
                className="text-white/25 hover:text-danger/70 transition-colors" title="清空记录">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="py-2">
            {history.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageSquareText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] text-white/25 leading-relaxed">暂无历史记录</p>
                <p className="text-[10px] text-white/15 mt-1">检查句子后将在此显示</p>
              </div>
            ) : (
              history.map((item) => {
                const isActive = activeHistoryId === item.id;
                return (
                  <button key={item.id} onClick={() => handleSelectHistory(item)}
                    className={`w-full text-left px-4 py-3 transition-all duration-150 border-l-2 group
                      ${isActive ? "bg-primary/10 border-l-primary" : "border-l-transparent hover:bg-white/3 hover:border-l-white/15"}`}>
                    <div className="flex items-start gap-2.5">
                      {item.hasErrors
                        ? <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-warning" : "text-warning/50"}`} />
                        : <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-success" : "text-success/50"}`} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed line-clamp-2 ${isActive ? "text-white/85" : "text-white/55"} group-hover:text-white/75 transition-colors`}>
                          {item.original}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.hasErrors && <span className={`text-[10px] font-medium ${isActive ? "text-warning" : "text-warning/50"}`}>{item.errorCount} issues</span>}
                          <span className="text-[10px] text-white/20">{item.modelName}</span>
                          <span className="text-[10px] text-white/15">{formatTime(item.timestamp)}</span>
                        </div>
                      </div>
                      <button onClick={(e) => handleDeleteHistory(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-danger/60 transition-all p-0.5" title="删除">
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
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="shrink-0 w-7 flex items-center justify-center bg-bg-main hover:bg-white/50 transition-colors group"
        title={sidebarOpen ? "收起侧栏" : "展开侧栏"}>
        {sidebarOpen
          ? <PanelLeftClose className="w-3.5 h-3.5 text-text-light group-hover:text-text-secondary transition-colors" />
          : <PanelLeftOpen className="w-3.5 h-3.5 text-text-light group-hover:text-text-secondary transition-colors" />
        }
      </button>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="flex-1 overflow-y-auto bg-bg-main">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {/* Header */}
          <div className="text-center mb-8 animate-slide-up">
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">✍️ 语法与表达纠错</h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              文本/语音/拍照上传 — AI 全面分析语法错误并推荐更地道的表达
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
            {/* "New check" when viewing history */}
            {result && activeHistoryId && (
              <div className="flex justify-end mb-3">
                <button onClick={handleNewCheck}
                  className="text-xs text-text-light hover:text-primary transition-colors">+ 新分析</button>
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); setActiveHistoryId(null); }}
              onKeyDown={handleKeyDown}
              placeholder="输入英文句子、语音录入或拖拽上传文件...&#10;e.g. He go to school yesterday"
              rows={5}
              className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                         placeholder:text-text-light/60 resize-none focus:outline-none focus:border-primary/40
                         focus:ring-2 focus:ring-primary/10 transition-all"
            />

            {/* Toolbar: voice + upload + model + check */}
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Voice input */}
                {!speech.isListening ? (
                  <button onClick={speech.start}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                               bg-gray-100 text-text-secondary hover:bg-[#5B4FCF]/10 hover:text-[#5B4FCF] transition-colors"
                    title="语音输入">
                    <Mic className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">语音</span>
                  </button>
                ) : (
                  <button onClick={speech.stop}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                               bg-red-500 text-white animate-pulse transition-colors">
                    <MicOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">停止</span>
                  </button>
                )}

                {/* File upload */}
                <input ref={fileInputRef} type="file" accept="image/*,.txt,.md,.csv" onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                             bg-gray-100 text-text-secondary hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                  title="上传图片或文档">
                  {uploading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5" />
                  }
                  <span className="hidden sm:inline">{uploading ? "提取中..." : "上传"}</span>
                </button>

                {/* Model selector */}
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                             focus:outline-none focus:border-primary/40 cursor-pointer">
                  {models.map((m) => (
                    <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>

              <button onClick={handleCheck} disabled={loading || !text.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                           bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-md shadow-indigo-500/25
                           hover:shadow-lg hover:shadow-indigo-500/35 hover:-translate-y-0.5
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "分析中..." : "检查语法"}
              </button>
            </div>

            {/* Listening indicator */}
            {speech.isListening && (
              <div className="mt-3">
                <p className="text-center text-xs text-red-500 animate-pulse font-medium">
                  🎤 正在听... / Listening...
                </p>
                {speech.interimText && (
                  <p className="text-center text-xs text-gray-400 italic">{speech.interimText}</p>
                )}
              </div>
            )}

            {/* Recognized text */}
            {speech.recognizedText && !speech.isListening && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <p className="text-xs font-semibold text-emerald-700 mb-0.5">🎙️ 识别结果:</p>
                <p className="text-sm text-emerald-800">{speech.recognizedText}</p>
              </div>
            )}

            {/* Drag/drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`mt-3 border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                dragOver ? "border-[#5B4FCF] bg-[#5B4FCF]/5" : "border-border/60 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-center gap-3 text-xs text-text-light">
                <FileText className="w-4 h-4" />
                <span>拖拽图片 (截图/拍照) 或 .txt 文档到这里自动提取英文文本</span>
                <ImageIcon className="w-4 h-4" />
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}
          </div>

          {/* ═══════ Result Card ═══════ */}
          {result && (
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm animate-slide-up mb-6">
              {/* Status Badge */}
              <div className="flex items-center gap-3 mb-5">
                {result.has_errors ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="text-xs font-semibold text-warning">发现 {result.errors.length} 个问题</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-xs font-semibold text-success">完全正确！</span>
                  </div>
                )}
                {activeHistoryId && (
                  <span className="text-[10px] text-text-light/60 bg-bg-main px-2 py-1 rounded-md">历史查看</span>
                )}
              </div>

              {/* Original → Corrected */}
              {result.has_errors && (
                <div className="mb-5 p-4 rounded-xl bg-bg-main border border-border">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-text-light w-16 shrink-0 pt-0.5">原文</span>
                      <p className="text-sm text-danger line-through">{result.original}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-success w-16 shrink-0 pt-0.5">纠正</span>
                      <p className="text-sm text-success font-medium">{result.corrected}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Grammar Error List ─── */}
              {result.errors.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider mb-3">
                    语法错误详情 Grammar Errors
                  </h3>
                  <div className="space-y-3">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-warning/3 border border-warning/10">
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-bold uppercase">
                          {ERROR_TYPE_LABELS[err.type] || err.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="text-danger line-through font-medium">{err.original_text}</span>
                            <ArrowRight className="w-3 h-3 text-text-light shrink-0" />
                            <span className="text-success font-medium">{err.corrected_text}</span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">{err.explanation}</p>
                          {err.explanation_cn && (
                            <p className="text-[11px] text-text-light mt-0.5 leading-relaxed">{err.explanation_cn}</p>
                          )}
                          {err.better_expression && (
                            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                              <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 mb-1">
                                <Star className="w-3 h-3" /> 更优表达
                              </p>
                              <p className="text-xs text-amber-800 leading-relaxed">{err.better_expression}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Expression Improvements ─── */}
              {result.expression_improvements && result.expression_improvements.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    表达优化建议 Better Expression
                  </h3>
                  <div className="space-y-3">
                    {result.expression_improvements.map((ei, i) => (
                      <div key={i} className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="text-text-light line-through">{ei.original_phrase}</span>
                          <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="text-amber-700 font-semibold">{ei.improved_phrase}</span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">{ei.explanation}</p>
                        {ei.explanation_cn && (
                          <p className="text-[11px] text-text-light mt-0.5 leading-relaxed">{ei.explanation_cn}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
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
