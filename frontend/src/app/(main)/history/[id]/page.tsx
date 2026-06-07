"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sessionsApi, SessionDetail, DetailMessage } from "@/lib/api";
import { ArrowLeft, Bot, User, Mic, AlertCircle, CheckCircle2, Lightbulb, TrendingUp, Clock, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

/* ──── Expandable analysis panel ──── */
function AnalysisPanel({ message, defaultOpen }: { message: DetailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasData = message.pronunciation || message.grammar;

  if (!hasData) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-[#5B4FCF]/70 hover:text-[#5B4FCF] transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        查看分析详情
      </button>

      {open && (
        <div className="mt-2 space-y-3 animate-slide-up">
          {/* Pronunciation */}
          {message.pronunciation && (
            <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Mic className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-bold text-purple-700">发音评测</span>
                <span className="ml-auto text-xs font-bold text-purple-600">
                  {message.pronunciation.overall_score}/100
                </span>
              </div>

              {/* Word-level analysis */}
              {message.pronunciation.words.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {message.pronunciation.words.map((w, i) => {
                    const isError = w.error_type !== "None";
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                          ${isError
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-100"
                          }`}
                        title={isError ? `${w.error_type}: ${w.word} (${w.accuracy_score})` : "正确"}
                      >
                        {w.word}
                        {isError && (
                          <span className="text-[10px] opacity-70">({w.accuracy_score})</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Scores */}
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                {[
                  { label: "准确度", v: message.pronunciation.accuracy_score },
                  { label: "流利度", v: message.pronunciation.fluency_score },
                  { label: "完整度", v: message.pronunciation.completeness_score },
                ].map((s) => (
                  <div key={s.label} className="bg-white/60 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-text-primary">{s.v}</div>
                    <div className="text-[9px] text-text-light">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grammar */}
          {message.grammar && (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">语法/表达改进</span>
              </div>

              {/* Original vs Corrected */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-text-light">原文：</span>
                  <span className="text-red-600 line-through">{message.grammar.original_text}</span>
                </div>
                <div>
                  <span className="text-text-light">纠正：</span>
                  <span className="text-green-600 font-medium">{message.grammar.corrected_text}</span>
                </div>
                {message.grammar.explanation && (
                  <p className="text-text-light italic">💡 {message.grammar.explanation}</p>
                )}
                {message.grammar.better_expression && (
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Lightbulb className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-blue-700 font-medium text-[11px]">更地道的表达：</span>
                      <span className="text-blue-600">{message.grammar.better_expression}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──── Message bubble with translation ──── */
function MessageBubble({ message }: { message: DetailMessage }) {
  const isUser = message.role === "user";
  const hasAnalysis = isUser && (message.pronunciation || message.grammar);

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                        border border-white/10 flex items-center justify-center shadow-sm shrink-0 mt-1">
          <Bot className="w-4 h-4 text-[#9B8FFF]" />
        </div>
      )}

      <div className={`max-w-[70%] ${isUser ? "order-1" : ""}`}>
        {/* English content */}
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white rounded-br-md shadow-md shadow-indigo-200"
            : "bg-white border border-border text-text-primary rounded-bl-md shadow-sm"
        }`}>
          {message.content}
        </div>

        {/* Chinese translation */}
        {message.translation_cn && (
          <p className={`text-[11px] text-text-light mt-1 ${isUser ? "text-right mr-1" : "ml-1"}`}>
            {message.translation_cn}
          </p>
        )}

        {/* Analysis */}
        {hasAnalysis && <AnalysisPanel message={message} defaultOpen={false} />}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C8956C] to-[#E0B894]
                        flex items-center justify-center text-white text-xs font-bold
                        shadow-sm shrink-0 mt-1">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Detail Page
   ══════════════════════════════════════════════════════════════ */
export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) return;
    sessionsApi.getDetail(sessionId)
      .then(({ data: d }) => { setData(d); setLoading(false); })
      .catch((err) => { setError("加载失败: " + (err?.response?.data?.detail || err.message)); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-light">
          <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" />
          <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-text-secondary text-sm">{error || "会话数据不存在"}</p>
          <button onClick={() => router.back()} className="mt-4 text-sm text-[#5B4FCF] hover:underline">返回</button>
        </div>
      </div>
    );
  }

  const userMessages = data.messages.filter((m) => m.role === "user");

  return (
    <div className="h-full flex flex-col bg-[#FAFAF8]">
      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-border px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-text-light hover:text-[#5B4FCF] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            返回历史列表
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
                {data.scene_name}
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#5B4FCF]/10 text-[#5B4FCF] font-semibold">
                  {data.difficulty}
                </span>
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-text-light">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{data.created_at ? new Date(data.created_at).toLocaleString("zh-CN") : ""}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{data.total_rounds} 轮对话</span>
              </div>
            </div>

            {/* Score card */}
            <div className="flex items-center gap-4">
              <div className="text-center px-4 py-2 rounded-2xl bg-gradient-to-br from-[#5B4FCF]/8 to-[#7C6FF7]/5 border border-[#5B4FCF]/15">
                <div className="text-3xl font-extrabold bg-gradient-to-r from-[#5B4FCF] to-[#9B8FFF] bg-clip-text text-transparent">
                  {data.avg_pronunciation_score}
                </div>
                <div className="text-[10px] text-text-light font-medium">综合评分 / 100</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                {[
                  { label: "已纠正", v: data.messages.filter(m => m.grammar).length, icon: CheckCircle2, color: "text-green-600" },
                  { label: "发音分析", v: data.messages.filter(m => m.pronunciation).length, icon: Mic, color: "text-purple-600" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-xl px-3 py-2 border border-border">
                      <Icon className={`w-3.5 h-3.5 ${s.color} mx-auto mb-0.5`} />
                      <span className="font-bold text-text-primary">{s.v}</span>
                      <span className="text-[9px] text-text-light block">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
          {data.messages.length === 0 ? (
            <div className="text-center py-12 text-text-light text-sm">暂无对话记录</div>
          ) : (
            data.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom summary bar ── */}
      <div className="shrink-0 bg-white border-t border-border px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-text-light">
            <span>{data.messages.length} 条消息</span>
            <span className="text-[#5B4FCF] font-medium">{userMessages.filter(m => m.pronunciation).length} 条已评测</span>
          </div>
          <button
            onClick={() => router.push(`/report?sessionId=${data.session_id}`)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7]
                       text-white text-xs font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5
                       transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            查看课后总结
          </button>
        </div>
      </div>
    </div>
  );
}
