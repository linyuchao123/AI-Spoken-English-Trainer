"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import {
  Settings2,
  Target,
  Layers,
  Bot,
  Sparkles,
  StopCircle,
  BarChart3,
  Zap,
} from "lucide-react";

const DIFFICULTY_ICONS: Record<string, string> = {
  beginner: "🌱",
  intermediate: "🌿",
  advanced: "🌳",
};

export default function Sidebar() {
  const {
    sidebarOpen,
    scenes,
    difficulties,
    models,
    configLoaded,
    loadConfig,
    currentScene,
    currentDifficulty,
    currentModel,
    setCurrentScene,
    setCurrentDifficulty,
    setCurrentModel,
    activeSession,
    createSession,
    endSession,
  } = useAppStore();

  useEffect(() => {
    if (!configLoaded) loadConfig();
  }, [configLoaded, loadConfig]);

  const currentSceneData = scenes.find((s) => s.key === currentScene);

  return (
    <aside
      className={`
        h-full bg-gradient-to-b from-[#1A1D28] via-[#232738] to-[#2A2E3D]
        flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0
        ${sidebarOpen ? "w-72" : "w-0"}
      `}
    >
      <div className="flex-1 overflow-y-auto px-4 py-5 min-w-[288px]">
        {/* Header */}
        <div className="text-center mb-5">
          <Settings2 className="w-7 h-7 text-white/50 mx-auto mb-1" />
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
            练习控制台
          </p>
        </div>

        <div className="h-px bg-white/8 mb-5" />

        {/* Scene Selection */}
        <SectionTitle icon={<Target className="w-3.5 h-3.5" />} text="练习场景" />
        <select
          value={currentScene}
          onChange={(e) => setCurrentScene(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm
                     focus:outline-none focus:border-[#C8956C]/50 transition-colors cursor-pointer
                     appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.5)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
          }}
        >
          {scenes.map((scene) => (
            <option key={scene.key} value={scene.key} className="bg-[#232738] text-white">
              {scene.icon}  {scene.name}
            </option>
          ))}
        </select>
        {currentSceneData && (
          <p className="text-[11px] text-white/40 mt-1.5 px-1">
            💬 {currentSceneData.description}
          </p>
        )}

        {/* Difficulty Selection */}
        <div className="mt-5">
          <SectionTitle icon={<Layers className="w-3.5 h-3.5" />} text="难度档位" />
          <div className="flex gap-2">
            {difficulties.map((d) => {
              const isActive = currentDifficulty === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setCurrentDifficulty(d.key)}
                  className={`
                    flex-1 py-2 rounded-full text-[11px] font-medium border transition-all duration-200
                    ${
                      isActive
                        ? "bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white border-transparent shadow-md shadow-indigo-500/30"
                        : "text-white/70 border-white/12 hover:border-[#C8956C]/40 hover:bg-[#C8956C]/10"
                    }
                  `}
                >
                  {DIFFICULTY_ICONS[d.key] || "📊"} {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selection */}
        <div className="mt-5">
          <SectionTitle icon={<Bot className="w-3.5 h-3.5" />} text="AI 模型" />
          <div className="flex gap-2">
            {models.map((m) => {
              const isActive = currentModel === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setCurrentModel(m.key)}
                  className={`
                    flex-1 py-2 rounded-full text-[11px] font-medium border transition-all duration-200
                    ${
                      isActive
                        ? "bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white border-transparent shadow-md shadow-indigo-500/30"
                        : "text-white/70 border-white/12 hover:border-[#C8956C]/40 hover:bg-[#C8956C]/10"
                    }
                  `}
                >
                  {m.icon} {m.name}
                </button>
              );
            })}
          </div>
          {(() => {
            const cur = models.find((m) => m.key === currentModel);
            return cur ? (
              <p className="text-[11px] text-white/40 mt-1.5 px-1 italic">
                {cur.description}
              </p>
            ) : null;
          })()}
        </div>

        <div className="h-px bg-white/8 my-5" />

        {/* Session Controls */}
        <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} text="会话管理" />
        <div className="flex gap-2 mt-2">
          <button
            onClick={createSession}
            className="flex-1 py-2.5 rounded-full text-xs font-bold text-white
                       bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7]
                       shadow-md shadow-indigo-500/30
                       hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5
                       transition-all duration-200"
          >
            ✨ 新建会话
          </button>
          <button
            onClick={endSession}
            disabled={!activeSession}
            className="flex-1 py-2.5 rounded-full text-xs font-semibold
                       text-white/70 bg-white/6 border border-white/10
                       hover:bg-white/12 hover:border-white/25
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            <StopCircle className="w-3.5 h-3.5 inline mr-1" />
            结束会话
          </button>
        </div>

        {/* Session Status */}
        {activeSession ? (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-emerald-400 text-xs font-semibold">🟢 会话进行中</p>
            <p className="text-white/50 text-[11px] mt-1">
              {activeSession.scene_name} · {activeSession.difficulty} · {activeSession.total_rounds} 轮
            </p>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-blue-400 text-xs">
              💡 点击「新建会话」开始练习
            </p>
          </div>
        )}

        <div className="h-px bg-white/8 my-5" />

        {/* Report Button */}
        <SectionTitle icon={<BarChart3 className="w-3.5 h-3.5" />} text="学习报告" />
        <button
          disabled={!activeSession}
          className="w-full mt-2 py-2.5 rounded-full text-xs font-semibold
                     text-white/70 bg-white/6 border border-white/10
                     hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          📋 生成课后报告
        </button>
      </div>
    </aside>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-white/40">{icon}</span>
      <h5 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
        {text}
      </h5>
    </div>
  );
}
