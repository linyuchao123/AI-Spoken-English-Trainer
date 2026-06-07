"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reportApi, ReportData, sessionsApi, Session } from "@/lib/api";
import { BarChart3, TrendingUp, Target, Zap, AlertCircle, Loader2, CheckCircle2, XCircle, Lightbulb, BookOpen } from "lucide-react";

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-light w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444" }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

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
            <div className="text-right">
              <span className="text-lg font-extrabold text-[#5B4FCF]">{s.avg_pronunciation_score.toFixed(0)}</span>
              <span className="text-[10px] text-text-light"> /100</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

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

  // Auto-load from ?sessionId=xxx
  useEffect(() => {
    const sid = searchParams.get("sessionId");
    if (sid) fetchReport(Number(sid));
  }, [searchParams]);

  if (mode === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5B4FCF] mx-auto mb-4" />
        <p className="text-text-secondary text-sm">AI is analyzing your conversation...</p>
        <p className="text-text-light text-xs mt-1">This may take 10-20 seconds</p>
      </div>
    );
  }

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

  // ---- Report View ----
  const score = report.avg_pronunciation_score;
  const scoreColor = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary mb-1">{report.scene_name}</h1>
        <p className="text-text-secondary text-sm">{report.difficulty} · {report.model} · {report.total_rounds} rounds</p>
        {report.level_assessment && (
          <div className="inline-block mt-2 px-3 py-1 rounded-full bg-[#5B4FCF]/10 border border-[#5B4FCF]/20">
            <span className="text-xs font-semibold text-[#5B4FCF]">{report.level_assessment}</span>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#5B4FCF]" /> AI Analysis
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">{report.summary}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Zap className="w-4 h-4" />} label="Messages" value={report.message_count} />
        <StatCard icon={<Target className="w-4 h-4" />} label="Scores" value={report.score_count} />
        <StatCard icon={<XCircle className="w-4 h-4" />} label="Corrections" value={report.correction_count} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Avg Score" value={Math.round(score)} color={scoreColor} />
      </div>

      {/* Score Bar */}
      {score > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
          <h2 className="text-sm font-bold text-text-primary mb-4">🎯 Overall Pronunciation</h2>
          <ScoreBar label="Score" score={score} />
        </div>
      )}

      {/* Score History */}
      {report.score_history.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
          <h2 className="text-sm font-bold text-text-primary mb-4">📈 Round-by-Round Scores</h2>
          <div className="flex items-end gap-2 h-24">
            {report.score_history.map((p) => {
              const h = Math.max((p.score / 100) * 100, 4);
              const c = p.score >= 85 ? "bg-emerald-500" : p.score >= 70 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={p.round} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-text-primary">{p.score}</span>
                  <div className={`w-full ${c} rounded-t-md transition-all`} style={{ height: `${h}%` }} />
                  <span className="text-[9px] text-text-light">R{p.round}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Stats */}
      {Object.keys(report.error_stats).length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
          <h2 className="text-sm font-bold text-text-primary mb-3">📊 Error Distribution</h2>
          <div className="space-y-2">
            {Object.entries(report.error_stats).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{type}</span>
                <span className="font-bold text-text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths + Weaknesses */}
      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Strengths
          </h2>
          {report.strengths.length > 0 ? (
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-emerald-500 mt-1 shrink-0">•</span> {s}
                </li>
              ))}
            </ul>
          ) : <p className="text-text-light text-xs">No strengths recorded</p>}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" /> To Improve
          </h2>
          {report.weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-red-500 mt-1 shrink-0">•</span> {w}
                </li>
              ))}
            </ul>
          ) : <p className="text-text-light text-xs">No weaknesses recorded</p>}
        </div>
      </div>

      {/* Suggestions */}
      {report.suggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Suggestions
          </h2>
          <ul className="space-y-2">
            {report.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                <span className="font-bold text-amber-500 mt-0.5 shrink-0">{i + 1}.</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Topics */}
      {report.topics_covered.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-5">
          <h2 className="text-sm font-bold text-text-primary mb-3">💬 Topics Discussed</h2>
          <div className="flex flex-wrap gap-2">
            {report.topics_covered.map((t, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-[#5B4FCF]/10 text-[#5B4FCF] text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="text-center">
        <button onClick={() => { setReport(null); setMode("select"); }}
          className="text-sm text-text-light hover:text-[#5B4FCF] transition-colors underline">
          ← Choose another session
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
      <div className="flex justify-center mb-1" style={{ color: color || "#5B4FCF" }}>{icon}</div>
      <p className="text-xl font-extrabold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-light">{label}</p>
    </div>
  );
}
