"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionsApi, Session } from "@/lib/api";
import { Clock, BarChart3, Zap, ChevronRight, Trash2 } from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = () => {
    sessionsApi.list(20).then(({ data }) => {
      setSessions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleDelete = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    if (!confirm("确定要删除这条历史会话吗？此操作不可撤销。")) return;
    try {
      await sessionsApi.delete(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      alert("删除失败，请重试");
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-text-primary flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#5B4FCF]" />
          历史会话
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          查看你的英语口语练习记录，点击进入详情
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-light text-sm">加载中...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-text-light/50 mx-auto mb-4" />
          <p className="text-text-secondary text-sm">暂无历史会话记录，快去开始练习吧！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() => router.push(`/history/${session.id}`)}
              onDelete={(e) => handleDelete(e, session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  onClick,
  onDelete,
}: {
  session: Session;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const statusColor = session.status === "active" ? "text-emerald-500" : "text-text-light";
  const statusText = session.status === "active" ? "进行中" : "已结束";
  const date = session.created_at ? new Date(session.created_at).toLocaleDateString("zh-CN") : "";

  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-xl border border-border p-4 hover:shadow-lg hover:border-[#5B4FCF]/20 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-text-primary text-sm">{session.scene_name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5B4FCF]/10 text-[#5B4FCF] font-medium">
              {session.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-light">
            <span>{date}</span>
            <span>{session.total_rounds} 轮对话</span>
            <span className={statusColor}>{statusText}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xl font-extrabold text-[#5B4FCF]">
              {session.avg_pronunciation_score.toFixed(0)}
            </div>
            <div className="text-[10px] text-text-light">/ 100</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-light/30 group-hover:text-[#5B4FCF] group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center
                   opacity-0 group-hover:opacity-100 transition-all
                   text-text-light/30 hover:text-red-500 hover:bg-red-50"
        title="删除此会话"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
