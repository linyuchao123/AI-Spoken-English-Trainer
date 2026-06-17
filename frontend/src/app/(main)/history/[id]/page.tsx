"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { sessionsApi, SessionDetail, DetailMessage } from "@/lib/api";
import { ArrowLeft, Bot, User, Mic, AlertCircle, CheckCircle2, Lightbulb, TrendingUp, Clock, MessageSquare, ChevronDown, ChevronUp, BarChart3, PlayCircle } from "lucide-react";

/* ──── Audio Player Helper ──── */
function playBase64Audio(base64: string, formatOrMime = "mp3"): Promise<void> {
  return new Promise((resolve) => {
    let mime: string;
    if (formatOrMime.includes("/")) {
      mime = formatOrMime.split(";")[0];
    } else {
      mime = formatOrMime === "mp3" ? "audio/mpeg" : `audio/${formatOrMime}`;
    }
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/* ──────────── Voice bar helpers ──────────── */

function formatVoiceDuration(sec: number): string {
  if (!sec || sec <= 0) return "1''";
  return `${Math.round(sec)}''`;
}

function getVoiceBarWidth(sec: number): number {
  if (!sec || sec <= 0) return 100;
  return Math.min(240, Math.max(90, 70 + sec * 14));
}

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
                <span className="text-xs font-bold text-purple-700">Chivox 发音评测</span>
                <span className="ml-auto text-xs font-bold text-purple-600">
                  {message.pronunciation.overall_score}/100
                </span>
              </div>

              {/* Extended scores: stress, intonation, rhythm */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: "重音", v: message.pronunciation.stress_score },
                  { label: "语调", v: message.pronunciation.intonation_score },
                  { label: "节奏", v: message.pronunciation.rhythm_score },
                ].map((s) => (
                  <div key={s.label} className="bg-white/60 rounded-lg py-1.5 text-center">
                    <div className="text-xs font-bold text-text-primary">{Math.round(s.v)}</div>
                    <div className="text-[9px] text-text-light">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Phoneme highlights */}
              {message.pronunciation.phoneme_highlights.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-amber-600 font-medium mb-1">音素问题</p>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {message.pronunciation.phoneme_highlights.map((issue, i) => (
                      <p key={i} className="text-[10px] text-amber-700 leading-relaxed">{issue}</p>
                    ))}
                  </div>
                </div>
              )}

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
                        title={isError ? `${w.error_type}: ${w.word} (${w.accuracy_score})${w.correction_cn ? ' — ' + w.correction_cn : ''}` : "正确"}
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
  const [audioPlaying, setAudioPlaying] = useState(false);

  const handlePlayAudio = () => {
    if (!message.audio_base64 || audioPlaying) return;
    setAudioPlaying(true);
    playBase64Audio(message.audio_base64, message.audio_mime_type || "webm")
      .finally(() => setAudioPlaying(false));
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                        border border-white/10 flex items-center justify-center shadow-sm shrink-0 mt-1">
          <Bot className="w-4 h-4 text-[#9B8FFF]" />
        </div>
      )}

      <div className={`max-w-[70%]`}>
        {/* WeChat-style voice message bar */}
        {isUser && message.audio_base64 && (
          <div className="flex justify-end mb-1.5">
            <button
              onClick={handlePlayAudio}
              className="group relative flex items-center gap-2 px-3.5 py-2 rounded-2xl rounded-br-sm
                         bg-white border border-gray-150
                         hover:bg-green-50 hover:border-green-200
                         shadow-sm hover:shadow-md
                         transition-all duration-200 active:scale-[0.97]"
              style={{ width: getVoiceBarWidth(message.audio_duration || 1) }}
              title="点击播放录音"
            >
              {/* Speaker icon */}
              <div className={`shrink-0 transition-all duration-200 ${audioPlaying ? "text-green-500 scale-110" : "text-gray-400 group-hover:text-green-500"}`}>
                {audioPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity="0.3"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity="0.3"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </svg>
                )}
              </div>

              {/* Waveform bars */}
              <div className="flex items-center gap-[2px] flex-1 justify-center">
                {[0.6, 1, 0.5, 0.85, 0.4].map((h, i) => (
                  <span
                    key={i}
                    className={`w-[3px] rounded-full bg-green-500 transition-all duration-75
                      ${audioPlaying ? "animate-voice-wave" : ""}`}
                    style={{
                      height: audioPlaying ? `${6 + h * 12}px` : `${4 + h * 6}px`,
                      animationDelay: audioPlaying ? `${i * 0.12}s` : "0s",
                      opacity: audioPlaying ? 0.9 : 0.4,
                    }}
                  />
                ))}
              </div>

              {/* Duration label */}
              <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                {formatVoiceDuration(message.audio_duration || 0)}
              </span>

              {/* Playing indicator dot */}
              {audioPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>
              )}
            </button>
          </div>
        )}

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
  const searchParams = useSearchParams();
  const sessionId = Number(params.id);
  const isPrintMode = searchParams.get("print") === "1";

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEvaluation, setShowEvaluation] = useState(false);

  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) return;
    sessionsApi.getDetail(sessionId)
      .then(({ data: d }) => { setData(d); setLoading(false); })
      .catch((err) => { setError("加载失败: " + (err?.response?.data?.detail || err.message)); setLoading(false); });
  }, [sessionId]);

  // Auto-print and expand evaluation in print mode
  useEffect(() => {
    if (!loading && data && isPrintMode) {
      setShowEvaluation(true);
      setTimeout(() => window.print(), 600);
    }
  }, [loading, data, isPrintMode]);

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

  return (
    <div className="h-full flex flex-col bg-[#FAFAF8]">
      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-border px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
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

            {/* Overall score */}
            <div className="text-center px-5 py-3 rounded-2xl bg-gradient-to-br from-[#5B4FCF]/8 to-[#7C6FF7]/5 border border-[#5B4FCF]/15">
              <div className="text-3xl font-extrabold bg-gradient-to-r from-[#5B4FCF] to-[#9B8FFF] bg-clip-text text-transparent">
                {data.avg_pronunciation_score}
              </div>
              <div className="text-[10px] text-text-light font-medium">综合评分 / 100</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Collapsible Multi-dimension Scores ── */}
      {data.evaluation && (
        <div className="shrink-0 bg-white border-b border-border px-6 py-2">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setShowEvaluation(!showEvaluation)}
              className="flex items-center gap-2 text-xs font-medium text-[#5B4FCF]/70 hover:text-[#5B4FCF] transition-colors w-full py-1"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              查看多维度评分与分析
              {showEvaluation ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              <span className="text-[10px] text-text-light font-normal ml-1">（共 6 维度 · AI 点评）</span>
            </button>

            {showEvaluation && (
              <div className="py-4 space-y-4 animate-slide-up">
                {/* Score grid */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: "语法", score: data.evaluation.grammar_score, icon: "📝", color: "#6366F1" },
                    { label: "词汇", score: data.evaluation.vocabulary_score, icon: "📚", color: "#8B5CF6" },
                    { label: "流利度", score: data.evaluation.fluency_score, icon: "💬", color: "#06B6D4" },
                    { label: "表达", score: data.evaluation.expression_score, icon: "✨", color: "#F59E0B" },
                    { label: "自然度", score: data.evaluation.naturalness_score, icon: "🌿", color: "#10B981" },
                    { label: "情感", score: data.evaluation.emotion_score, icon: "🎯", color: "#EC4899" },
                  ].map((dim) => (
                    <div key={dim.label} className="bg-[#FAFAF8] rounded-xl p-2.5 text-center border border-border/50">
                      <div className="text-base mb-0.5">{dim.icon}</div>
                      <div className="text-lg font-extrabold" style={{ color: dim.color }}>
                        {dim.score}
                      </div>
                      <div className="text-[9px] text-text-light font-medium">{dim.label}</div>
                      <div className="mt-1 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dim.score}%`, backgroundColor: dim.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {data.evaluation.summary && (
                  <p className="text-xs text-text-secondary leading-relaxed bg-[#FAFAF8] rounded-xl p-3 border border-border/50">
                    <span className="font-bold text-text-primary">AI 点评：</span>
                    {data.evaluation.summary}
                  </p>
                )}

                {/* Strengths & Weaknesses */}
                {(data.evaluation.strengths.length > 0 || data.evaluation.weaknesses.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.evaluation.strengths.length > 0 && (
                      <div className="bg-green-50/40 rounded-xl p-3 border border-green-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs font-bold text-green-700">做得好的</span>
                        </div>
                        <ul className="space-y-1">
                          {data.evaluation.strengths.map((s, i) => (
                            <li key={i} className="text-[11px] text-green-700 flex items-start gap-1">
                              <span className="text-green-400 mt-0.5">•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.evaluation.weaknesses.length > 0 && (
                      <div className="bg-amber-50/40 rounded-xl p-3 border border-amber-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">需要改进的</span>
                        </div>
                        <ul className="space-y-1">
                          {data.evaluation.weaknesses.map((w, i) => (
                            <li key={i} className="text-[11px] text-amber-700 flex items-start gap-1">
                              <span className="text-amber-400 mt-0.5">•</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            {data.evaluation && (
              <span className="text-[#5B4FCF] font-medium">综合 {data.evaluation.overall_score}/100</span>
            )}
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
