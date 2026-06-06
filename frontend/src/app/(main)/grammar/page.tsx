"use client";

import { useState, useEffect } from "react";
import { Sparkles, AlertCircle, CheckCircle2, ArrowRight, Loader2, History } from "lucide-react";
import { grammarApi, GrammarResult, Model, scenesApi } from "@/lib/api";

const ERROR_TYPE_LABELS: Record<string, string> = {
  grammar: "语法",
  vocabulary: "词汇",
  word_order: "语序",
  preposition: "介词",
  article: "冠词",
  tense: "时态",
  spelling: "拼写",
  punctuation: "标点",
};

export default function GrammarPage() {
  const [text, setText] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [history, setHistory] = useState<GrammarResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    scenesApi.getConfig().then(({ data }) => {
      setModels(data.models);
      if (data.models.length > 0) setSelectedModel(data.models[0].key);
    }).catch(() => {});
  }, []);

  const handleCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await grammarApi.correct(text.trim(), selectedModel);
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 20));
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

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <h1 className="text-2xl font-extrabold text-text-primary mb-2">
          ✍️ 语法与表达纠错
        </h1>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          输入英文句子，AI 将逐词分析语法、词汇、语序错误并提供纠正建议
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-3.5 h-3.5 text-text-light" />
            <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider">
              历史记录
            </h3>
          </div>
          <div className="space-y-2">
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => { setResult(item); setText(item.original); }}
                className="w-full text-left p-3 rounded-xl bg-white border border-border hover:border-primary/20
                           hover:shadow-sm transition-all duration-150 flex items-center gap-3 group"
              >
                {item.has_errors ? (
                  <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                )}
                <span className="text-xs text-text-secondary truncate flex-1 group-hover:text-text-primary transition-colors">
                  {item.original}
                </span>
                {item.has_errors && (
                  <span className="text-[10px] text-warning font-medium shrink-0">
                    {item.errors.length} issues
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
