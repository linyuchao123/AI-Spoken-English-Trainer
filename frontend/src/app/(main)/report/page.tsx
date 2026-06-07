"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reportApi, ReportData, sessionsApi, Session, ScoreBreakdown, SentenceAnalysisItem } from "@/lib/api";
import {
  BarChart3, TrendingUp, Target, Zap, AlertCircle, Loader2, CheckCircle2,
  XCircle, Lightbulb, BookOpen, Mic, Volume2, Pencil, Star, Flag, ArrowRight
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
function SentenceCard({ item }: { item: SentenceAnalysisItem }) {
  const hasIssues = item.pronunciation_issues.length > 0 || item.grammar_issues.length > 0 || item.expression_improvements.length > 0;
  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 原始句子 + 中文 */}
      <div className="mb-3">
        <p className="text-sm font-semibold text-text-primary leading-relaxed">{item.original_en}</p>
        <p className="text-xs text-text-light mt-1">{item.translation_cn}</p>
      </div>

      {!hasIssues && (
        <div className="flex items-center gap-2 text-emerald-600 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Great! No issues detected. / 很棒，没有发现问题！</span>
        </div>
      )}

      {/* 发音问题 */}
      {item.pronunciation_issues.length > 0 && (
        <div className="mb-2 bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5 mb-2">
            <Volume2 className="w-3.5 h-3.5" /> 发音 Pronunciation
          </p>
          <ul className="space-y-1">
            {item.pronunciation_issues.map((issue, i) => (
              <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5 shrink-0">▸</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 语法问题 */}
      {item.grammar_issues.length > 0 && (
        <div className="mb-2 bg-red-50 rounded-lg p-3 border border-red-100">
          <p className="text-xs font-bold text-red-700 flex items-center gap-1.5 mb-2">
            <Pencil className="w-3.5 h-3.5" /> 语法 Grammar
          </p>
          <ul className="space-y-1">
            {item.grammar_issues.map((issue, i) => (
              <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5 shrink-0">▸</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 表达优化 */}
      {item.expression_improvements.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-2">
            <Star className="w-3.5 h-3.5" /> 更优表达 Better Expression
          </p>
          <ul className="space-y-1">
            {item.expression_improvements.map((imp, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5 shrink-0">▸</span>
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
            <StatMini icon={<Zap className="w-3.5 h-3.5" />} label="Messages" labelCn="消息" value={report.message_count} />
            <StatMini icon={<Target className="w-3.5 h-3.5" />} label="Scores" labelCn="打分" value={report.score_count} />
            <StatMini icon={<Flag className="w-3.5 h-3.5" />} label="Corrections" labelCn="纠错" value={report.correction_count} />
            <StatMini icon={<TrendingUp className="w-3.5 h-3.5" />} label="Rounds" labelCn="轮次" value={report.total_rounds} />
          </div>
        </div>
      </div>

      {/* ═══ 多维度评分 ═══ */}
      {breakdown && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#5B4FCF]" /> 多维度评分 Multi-Dimension Scores
          </h2>
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
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#5B4FCF]" /> AI Analysis / AI 分析
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">{report.summary}</p>
        {report.summary_cn && (
          <p className="text-text-light text-xs leading-relaxed mt-2 pt-2 border-t border-border/50">
            {report.summary_cn}
          </p>
        )}
      </div>

      {/* ═══ 逐句分析 ═══ */}
      {report.sentence_analyses.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-[#5B4FCF]" /> 逐句分析 Sentence-by-Sentence Analysis
          </h2>
          <div className="space-y-4">
            {report.sentence_analyses.map((item, i) => (
              <SentenceCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ Strengths + Weaknesses ═══ */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Strengths / 优点
          </h2>
          {report.strengths.length > 0 ? (
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-emerald-500 mt-1 shrink-0 text-lg leading-none">•</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-light text-xs">No strengths recorded</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" /> To Improve / 待改进
          </h2>
          {report.weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-red-500 mt-1 shrink-0 text-lg leading-none">•</span>
                  <span className="leading-relaxed">{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-light text-xs">No weaknesses recorded</p>
          )}
        </div>
      </div>

      {/* ═══ Suggestions ═══ */}
      {report.suggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Suggestions / 学习建议
          </h2>
          <ul className="space-y-2">
            {report.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                <span className="font-bold text-amber-500 mt-0.5 shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
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
