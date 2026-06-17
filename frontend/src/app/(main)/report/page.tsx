"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reportApi, ReportData, sessionsApi, Session, ScoreBreakdown, SentenceAnalysisItem } from "@/lib/api";
import {
  BarChart3, TrendingUp, Target, Zap, AlertCircle, Loader2, CheckCircle2,
  XCircle, Lightbulb, BookOpen, Mic, Volume2, Pencil, Star, Flag, ArrowRight, MessageSquare
} from "lucide-react";

/* ──────────── 评分色环 ──────────── */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const strokeW = size * 0.1;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : pct >= 50 ? "#f97316" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <span className="absolute text-2xl font-extrabold" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

/* ──────────── 维度评分条 ──────────── */
function DimBar({ label, labelCn, score, icon }: { label: string; labelCn: string; score: number; icon: React.ReactNode }) {
  const pct = Math.min((score / 100) * 100, 100);
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : pct >= 50 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-text-light">{icon}</span>
          <span className="text-xs font-semibold text-text-primary">{label}</span>
          <span className="text-[10px] text-text-light">({labelCn})</span>
        </div>
        <span className="text-xs font-extrabold" style={{ color: pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444" }}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ──────────── 句子分析卡片 ──────────── */
function SentenceCard({ item, index }: { item: SentenceAnalysisItem; index: number }) {
  const hasChivox = item.chivox_score > 0;
  const hasPronunciation = item.pronunciation_issues.length > 0 || item.chivox_phoneme_issues.length > 0;
  const hasGrammar = item.grammar_issues.length > 0;
  const hasExpression = item.expression_improvements.length > 0;
  const hasAnyIssue = hasPronunciation || hasGrammar || hasExpression;
  const perfect = !hasAnyIssue && !hasChivox;

  const chivoxColor =
    item.chivox_score >= 85 ? "#10b981" :
    item.chivox_score >= 70 ? "#f59e0b" :
    item.chivox_score >= 50 ? "#f97316" : "#ef4444";

  const chivoxLabel =
    item.chivox_score >= 85 ? "优秀 Excellent" :
    item.chivox_score >= 70 ? "良好 Good" :
    item.chivox_score >= 50 ? "一般 Fair" : "需改进 Needs Work";

  const accentColor = perfect ? "bg-emerald-400" :
    item.chivox_score >= 85 ? "bg-emerald-400" :
    item.chivox_score >= 60 ? "bg-amber-400" : "bg-red-400";

  const totalIssues = item.pronunciation_issues.length + item.grammar_issues.length + item.expression_improvements.length;

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
      {/* Colored left accent bar */}
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${accentColor}`} />
        <div className="flex-1 p-5">
          {/* ── Header with sequence number & status badge ── */}
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 tracking-wide">
              <MessageSquare className="w-3 h-3" />
              SENTENCE #{index + 1}
            </span>
            {!perfect && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                hasChivox && item.chivox_score >= 85
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}>
                {totalIssues} 项改进建议 · {totalIssues} improvement{totalIssues > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* ── English + Chinese ── */}
          <div className="mb-5">
            <p className="text-[15px] font-semibold text-gray-800 leading-relaxed">
              {item.original_en}
            </p>
            <p className="mt-2 text-[13px] text-gray-400 leading-relaxed pl-3 border-l-2 border-gray-200/80">
              {item.translation_cn}
            </p>
          </div>

          {/* ── Score & Stat Row ── */}
          {(hasChivox || hasAnyIssue) && (
            <div className="flex flex-wrap items-center gap-2.5 mb-5 pb-4 border-b border-gray-100">
              {hasChivox && (
                <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3.5 py-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0"
                    style={{ borderColor: chivoxColor, backgroundColor: `${chivoxColor}12` }}
                  >
                    <span className="text-xs font-extrabold" style={{ color: chivoxColor }}>
                      {Math.round(item.chivox_score)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-700">发音评分</p>
                    <p className="text-[9px] text-gray-400">{chivoxLabel}</p>
                  </div>
                </div>
              )}
              {item.pronunciation_issues.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full border border-blue-100">
                  <Volume2 className="w-3 h-3" />
                  {item.pronunciation_issues.length}
                </span>
              )}
              {item.grammar_issues.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-full border border-red-100">
                  <Pencil className="w-3 h-3" />
                  {item.grammar_issues.length}
                </span>
              )}
              {item.expression_improvements.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full border border-amber-100">
                  <Star className="w-3 h-3" />
                  {item.expression_improvements.length}
                </span>
              )}
            </div>
          )}

          {/* ── Perfect badge ── */}
          {perfect && (
            <div className="flex items-center gap-2 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-600">Perfect! 完美表达 ✨</p>
                <p className="text-[10px] text-emerald-400">No issues found — great job on this sentence!</p>
              </div>
            </div>
          )}

          {/* ═══════ PRONUNCIATION ═══════ */}
          {hasPronunciation && (
            <div className="mb-4">
              <h4 className="flex items-center gap-1.5 mb-3">
                <Volume2 className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">发音评测 · Pronunciation</span>
                <span className="w-px h-3 bg-blue-200" />
                <span className="text-[10px] text-blue-400">Phoneme &amp; LLM Analysis</span>
              </h4>
              <div className="bg-gradient-to-br from-blue-50/60 to-sky-50/40 rounded-xl p-3.5 border border-blue-100/80 space-y-3">
                {/* Chivox phoneme-level */}
                {item.chivox_phoneme_issues.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-sky-700 mb-2 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-sky-500" />
                      Chivox 音素级分析 · Phoneme Analysis
                    </p>
                    <div className="space-y-1.5">
                      {item.chivox_phoneme_issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-sky-800 bg-white/70 rounded-lg px-3 py-2 border border-sky-100/50">
                          <span className="text-sky-400 mt-0.5 shrink-0">▸</span>
                          <span className="leading-relaxed">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Separator between Chivox and LLM */}
                {item.chivox_phoneme_issues.length > 0 && item.pronunciation_issues.length > 0 && (
                  <div className="border-t border-blue-200/50 my-1" />
                )}

                {/* LLM pronunciation feedback */}
                {item.pronunciation_issues.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-blue-700 mb-2 flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5 text-blue-500" />
                      发音技巧反馈 · Pronunciation Tips
                    </p>
                    <div className="space-y-1.5">
                      {item.pronunciation_issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-blue-700 bg-white/70 rounded-lg px-3 py-2 border border-blue-100/50">
                          <span className="text-blue-400 mt-0.5 shrink-0 font-bold">{i + 1}.</span>
                          <span className="leading-relaxed">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pronunciation summary tip */}
                {hasChivox && item.chivox_score < 85 && (
                  <div className="flex items-start gap-2 bg-amber-50/80 rounded-lg px-3 py-2.5 border border-amber-100">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      <span className="font-semibold">发音建议：</span>
                      注意重音、语调和音素的准确性，多听多模仿可以快速提升发音评分。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ GRAMMAR ═══════ */}
          {hasGrammar && (
            <div className="mb-4">
              <h4 className="flex items-center gap-1.5 mb-3">
                <Pencil className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">语法分析 · Grammar</span>
                <span className="w-px h-3 bg-red-200" />
                <span className="text-[10px] text-red-400">Error &amp; Correction</span>
              </h4>
              <div className="bg-gradient-to-br from-red-50/60 to-rose-50/40 rounded-xl p-3.5 border border-red-100/80 space-y-1.5">
                {item.grammar_issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-red-700 bg-white/70 rounded-lg px-3 py-2.5 border border-red-100/50">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-px">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ EXPRESSION ═══════ */}
          {hasExpression && (
            <div>
              <h4 className="flex items-center gap-1.5 mb-3">
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">表达优化 · Better Expression</span>
                <span className="w-px h-3 bg-amber-200" />
                <span className="text-[10px] text-amber-400">Natural &amp; Native</span>
              </h4>
              <div className="bg-gradient-to-br from-amber-50/60 to-yellow-50/40 rounded-xl p-3.5 border border-amber-100/80 space-y-1.5">
                {item.expression_improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-amber-700 bg-white/70 rounded-lg px-3 py-2.5 border border-amber-100/50">
                    <Lightbulb className="w-4 h-4 text-amber-400 mt-px shrink-0" />
                    <span className="leading-relaxed">{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────── 会话选择器 ──────────── */
function SessionSelector({ onSelect }: { onSelect: (s: Session) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionsApi.list(20).then(({ data }) => {
      setSessions(data.filter((s) => s.status === "ended"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-text-light mx-auto" />;
  if (sessions.length === 0) return <p className="text-text-light text-sm text-center">No completed sessions yet.</p>;

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <button key={s.id} onClick={() => onSelect(s)}
          className="w-full text-left bg-white rounded-xl border border-border p-4 hover:shadow-md hover:border-[#5B4FCF]/20 transition-all group">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-text-primary text-sm">{s.scene_name}</p>
              <p className="text-[11px] text-text-light">{s.difficulty} · {s.total_rounds} rounds</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-[#5B4FCF]">{s.avg_pronunciation_score.toFixed(0)}</span>
              <span className="text-[10px] text-text-light">/100</span>
              <ArrowRight className="w-4 h-4 text-text-light group-hover:text-[#5B4FCF] transition-colors" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════ 主页面 ═══════════════════════ */
export default function ReportPage() {
  const searchParams = useSearchParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"select" | "loading" | "result">("select");

  const fetchReport = async (sessionId: number) => {
    setLoading(true); setError(""); setMode("loading");
    try {
      const { data } = await reportApi.get(sessionId);
      setReport(data);
      setMode("result");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to generate report");
      setMode("select");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sid = searchParams.get("sessionId");
    if (sid) fetchReport(Number(sid));
  }, [searchParams]);

  /* ──── 加载态 ──── */
  if (mode === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5B4FCF] mx-auto mb-4" />
        <p className="text-text-secondary text-sm">AI is analyzing your conversation…</p>
        <p className="text-text-light text-xs mt-1">（AI 正在分析你的对话，大约需要 10-20 秒）</p>
      </div>
    );
  }

  /* ──── 选择态 ──── */
  if (mode === "select" || !report) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary mb-2">📋 课后报告</h1>
          <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
            Select a completed session to generate an AI-powered learning report.
          </p>
          <p className="text-text-light text-xs mt-1">选择一个已完成的会话，生成 AI 学习报告</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        <SessionSelector onSelect={(s) => fetchReport(s.id)} />
      </div>
    );
  }

  /* ════════════ 报告内容 ════════════ */
  const score = report.avg_pronunciation_score;
  const breakdown = report.score_breakdown;

  // Compute derived stats
  const totalPronunciationIssues = report.sentence_analyses.reduce((s, a) => s + a.pronunciation_issues.length, 0);
  const totalGrammarIssues = report.sentence_analyses.reduce((s, a) => s + a.grammar_issues.length, 0);
  const totalExpressionIssues = report.sentence_analyses.reduce((s, a) => s + a.expression_improvements.length, 0);
  const totalAllIssues = totalPronunciationIssues + totalGrammarIssues + totalExpressionIssues;
  const chivoxAvg = report.sentence_analyses.filter(a => a.chivox_score > 0).length > 0
    ? Math.round(report.sentence_analyses.filter(a => a.chivox_score > 0).reduce((s, a) => s + a.chivox_score, 0)
        / report.sentence_analyses.filter(a => a.chivox_score > 0).length)
    : 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in space-y-6">
      {/* ═══ 页头 ═══ */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="w-7 h-7 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary mb-1">{report.scene_name}</h1>
        <p className="text-text-secondary text-sm">
          {report.difficulty} · {report.model} · {report.total_rounds} rounds · {report.message_count} 条消息
        </p>
        {report.level_assessment && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="px-3 py-1 rounded-full bg-[#5B4FCF]/10 border border-[#5B4FCF]/20">
              <span className="text-xs font-semibold text-[#5B4FCF]">{report.level_assessment}</span>
            </div>
            {report.level_assessment_cn && (
              <span className="text-[11px] text-text-light">{report.level_assessment_cn}</span>
            )}
          </div>
        )}
      </div>

      {/* ═══ 综合评分卡片 ═══ */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col items-center justify-center">
          <p className="text-xs text-text-light mb-3 font-semibold uppercase tracking-wider">Overall Score / 综合评分</p>
          <ScoreRing score={score} size={100} />
          <p className="text-[10px] text-text-light mt-2">out of 100</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex items-center justify-center">
          <div className="grid grid-cols-2 gap-3 w-full">
            <StatMini icon={<Mic className="w-3.5 h-3.5" />} label="Chivox Avg" labelCn="驰声均分" value={chivoxAvg > 0 ? chivoxAvg : Math.round(score)} />
            <StatMini icon={<Flag className="w-3.5 h-3.5" />} label="Total Issues" labelCn="总问题" value={totalAllIssues} />
            <StatMini icon={<MessageSquare className="w-3.5 h-3.5" />} label="Sentences" labelCn="句子" value={report.sentence_analyses.length} />
            <StatMini icon={<TrendingUp className="w-3.5 h-3.5" />} label="Rounds" labelCn="轮次" value={report.total_rounds} />
          </div>
        </div>
      </div>

      {/* ═══ 多维度评分 ═══ */}
      {breakdown && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#5B4FCF]/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-[#5B4FCF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">多维度评分 · Multi-Dimension Scores</h2>
              <p className="text-[10px] text-text-light">AI evaluation across 6 key dimensions</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            <DimBar label="Grammar" labelCn="语法" score={breakdown.grammar_score} icon={<Pencil className="w-3.5 h-3.5" />} />
            <DimBar label="Vocabulary" labelCn="词汇" score={breakdown.vocabulary_score} icon={<BookOpen className="w-3.5 h-3.5" />} />
            <DimBar label="Fluency" labelCn="流畅度" score={breakdown.fluency_score} icon={<Zap className="w-3.5 h-3.5" />} />
            <DimBar label="Expression" labelCn="表达力" score={breakdown.expression_score} icon={<Mic className="w-3.5 h-3.5" />} />
            <DimBar label="Naturalness" labelCn="自然度" score={breakdown.naturalness_score} icon={<Target className="w-3.5 h-3.5" />} />
            <DimBar label="Emotion" labelCn="情感表达" score={breakdown.emotion_score} icon={<Star className="w-3.5 h-3.5" />} />
          </div>
        </div>
      )}

      {/* ═══ AI 分析总结 ═══ */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B4FCF]/10 to-[#7C6FF7]/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#5B4FCF]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">AI 综合分析 · Comprehensive Analysis</h2>
            <p className="text-[10px] text-text-light">Based on Chivox pronunciation + LLM evaluation</p>
          </div>
        </div>
        {report.summary ? (
          <div className="bg-gray-50/80 rounded-xl p-4 border border-border/50">
            <p className="text-text-secondary text-sm leading-relaxed">{report.summary}</p>
          </div>
        ) : (
          <div className="bg-gray-50/80 rounded-xl p-4 border border-border/50 text-center">
            <p className="text-text-light text-xs">
              No detailed analysis generated yet. Complete more conversation rounds for richer feedback.
            </p>
          </div>
        )}
        {report.summary_cn && (
          <div className="bg-[#5B4FCF]/5 rounded-xl p-4 border border-[#5B4FCF]/10 mt-3">
            <p className="text-text-light text-xs leading-relaxed">{report.summary_cn}</p>
          </div>
        )}
      </div>

      {/* ═══ 问题总览 / Issue Overview ═══ */}
      {report.sentence_analyses.length > 0 && (() => {
        const totalP = report.sentence_analyses.reduce((s, a) => s + a.pronunciation_issues.length, 0);
        const totalG = report.sentence_analyses.reduce((s, a) => s + a.grammar_issues.length, 0);
        const totalE = report.sentence_analyses.reduce((s, a) => s + a.expression_improvements.length, 0);
        const totalAll = totalP + totalG + totalE;
        if (totalAll === 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-[#5B4FCF]" /> 问题总览 · Issue Overview
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                <Volume2 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-extrabold text-blue-600">{totalP}</p>
                <p className="text-[11px] text-blue-500 font-medium">发音 Pronunciation</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <Pencil className="w-5 h-5 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-extrabold text-red-600">{totalG}</p>
                <p className="text-[11px] text-red-500 font-medium">语法 Grammar</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-extrabold text-amber-600">{totalE}</p>
                <p className="text-[11px] text-amber-500 font-medium">表达 Expression</p>
              </div>
            </div>
            <p className="text-center text-[11px] text-text-light mt-3">
              共 {report.sentence_analyses.length} 条句子 · {totalAll} 项改进建议 · {totalAll} improvement suggestions total
            </p>
          </div>
        );
      })()}

      {/* ═══ 逐句分析 ═══ */}
      {report.sentence_analyses.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#5B4FCF]/10 flex items-center justify-center">
              <Mic className="w-4 h-4 text-[#5B4FCF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">逐句分析 · Sentence-by-Sentence</h2>
              <p className="text-[10px] text-text-light">{report.sentence_analyses.length} sentences analyzed in detail</p>
            </div>
          </div>
          <div className="space-y-4">
            {report.sentence_analyses.map((item, i) => (
              <SentenceCard key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ Strengths + Weaknesses ═══ */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Strengths · 优点</h2>
              <p className="text-[10px] text-text-light">What you did well</p>
            </div>
          </div>
          {report.strengths.length > 0 ? (
            <ul className="space-y-2.5">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 bg-emerald-50/50 rounded-xl px-3.5 py-2.5 border border-emerald-100/50">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-secondary leading-relaxed">{s}</span>
                    <span className="block text-[10px] text-emerald-500 mt-0.5 font-medium">优点 · Strength</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-light text-xs italic">继续对话更多轮次来获取优点分析 · Talk more to get strength analysis</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">To Improve · 待改进</h2>
              <p className="text-[10px] text-text-light">Areas to focus on</p>
            </div>
          </div>
          {report.weaknesses.length > 0 ? (
            <ul className="space-y-2.5">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 bg-red-50/50 rounded-xl px-3.5 py-2.5 border border-red-100/50">
                  <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-secondary leading-relaxed">{w}</span>
                    <span className="block text-[10px] text-red-500 mt-0.5 font-medium">待改进 · To Improve</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-light text-xs italic">继续对话更多轮次来获取改进建议 · Talk more to get improvement tips</p>
          )}
        </div>
      </div>

      {/* ═══ Suggestions ═══ */}
      {report.suggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">学习建议 · Suggestions</h2>
              <p className="text-[10px] text-text-light">Personalized tips for improvement</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {report.suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50/50 rounded-xl px-4 py-3 border border-amber-100/50">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-extrabold shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-text-secondary leading-relaxed pt-0.5">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Topics ═══ */}
      {report.topics_covered.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary mb-3">💬 Topics Discussed / 讨论话题</h2>
          <div className="flex flex-wrap gap-2">
            {report.topics_covered.map((t, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-[#5B4FCF]/10 text-[#5B4FCF] text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 返回 ═══ */}
      <div className="text-center pb-8">
        <button onClick={() => { setReport(null); setMode("select"); }}
          className="text-sm text-text-light hover:text-[#5B4FCF] transition-colors underline">
          ← Choose another session / 选择另一个会话
        </button>
      </div>
    </div>
  );
}

/* ──── 辅助组件 ──── */
function StatMini({ icon, label, labelCn, value }: { icon: React.ReactNode; label: string; labelCn: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1 text-[#5B4FCF]">{icon}</div>
      <p className="text-lg font-extrabold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-light">
        {label} <span className="text-[9px]">· {labelCn}</span>
      </p>
    </div>
  );
}
