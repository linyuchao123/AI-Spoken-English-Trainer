"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, AlertCircle, CheckCircle2, ArrowRight, Loader2,
  PanelLeftClose, PanelLeftOpen, Trash2, MessageSquareText,
} from "lucide-react";
import { grammarApi, GrammarResult, Model, scenesApi } from "@/lib/api";

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

// ── Page Component ───────────────────────────────────────────
export default function GrammarPage() {
  const [text, setText] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState("");

  // Load models
  useEffect(() => {
    scenesApi.getConfig().then(({ data }) => {
      setModels(data.models);
      if (data.models.length > 0) setSelectedModel(data.models[0].key);
    }).catch(() => {});
  }, []);

  // ── Handlers ──────────────────────────────────────────────

  const handleCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await grammarApi.correct(text.trim(), selectedModel);
      setResult(data);
      // Add / update in history
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
      setError(err?.response?.data?.detail || "Grammar check failed. Please try again.");
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

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* ========================================================
          LEFT SIDEBAR — History Panel
          ======================================================== */}
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
                <MessageSquareText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] text-white/25 leading-relaxed">
                  暂无历史记录
                </p>
                <p className="text-[10px] text-white/15 mt-1">
                  检查句子后将在此显示
                </p>
              </div>
            ) : (
              history.map((item) => {
                const isActive = activeHistoryId === item.id;
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
                      {item.hasErrors ? (
                        <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-warning" : "text-warning/50"}`} />
                      ) : (
                        <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-success" : "text-success/50"}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed line-clamp-2 ${isActive ? "text-white/85" : "text-white/55"} group-hover:text-white/75 transition-colors`}>
                          {item.original}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.hasErrors && (
                            <span className={`text-[10px] font-medium ${isActive ? "text-warning" : "text-warning/50"}`}>
                              {item.errorCount} issues
                            </span>
                          )}
                          <span className="text-[10px] text-white/20">
                            {item.modelName}
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

      {/* ========================================================
          TOGGLE BUTTON
          ======================================================== */}
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

      {/* ========================================================
          RIGHT — Main Content Area
          ======================================================== */}
      <main className="flex-1 overflow-y-auto bg-bg-main">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {/* Header */}
          <div className="text-center mb-8 animate-slide-up">
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              ✍️ 语法与表达纠错
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              输入英文句子，AI 逐词分析语法、词汇、语序错误并提供纠正建议
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type or paste an English sentence here...&#10;e.g. He go to school yesterday"
              rows={4}
              className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                         placeholder:text-text-light/60 resize-none focus:outline-none focus:border-primary/40
                         focus:ring-2 focus:ring-primary/10 transition-all"
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                {/* Model Selector */}
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                             focus:outline-none focus:border-primary/40 cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
                  ))}
                </select>

                {/* New Check button (when viewing history result) */}
                {result && activeHistoryId && (
                  <button
                    onClick={handleNewCheck}
                    className="text-xs text-text-light hover:text-primary transition-colors"
                  >
                    + 新分析
                  </button>
                )}
              </div>

              <button
                onClick={handleCheck}
                disabled={loading || !text.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                           bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-md shadow-indigo-500/25
                           hover:shadow-lg hover:shadow-indigo-500/35 hover:-translate-y-0.5
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
                           transition-all duration-200"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? "分析中..." : "检查语法"}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-xs text-danger">{error}</p>
            )}
          </div>

          {/* Result Card */}
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
                  <span className="text-[10px] text-text-light/60 bg-bg-main px-2 py-1 rounded-md">
                    历史查看
                  </span>
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

              {/* Error List */}
              {result.errors.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider mb-3">
                    错误详情
                  </h3>
                  <div className="space-y-3">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-warning/3 border border-warning/10"
                      >
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-bold uppercase">
                          {ERROR_TYPE_LABELS[err.type] || err.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-danger line-through font-medium">{err.original_text}</span>
                            <ArrowRight className="w-3 h-3 text-text-light shrink-0" />
                            <span className="text-success font-medium">{err.corrected_text}</span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            {err.explanation}
                          </p>
                          {err.explanation_cn && (
                            <p className="text-[11px] text-text-light mt-0.5 leading-relaxed">
                              {err.explanation_cn}
                            </p>
                          )}
                        </div>
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
