"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import {
  Settings2,
  Target,
  Layers,
  Bot,
  Sparkles,
  StopCircle,
  BarChart3,
  Play,
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";

const DIFFICULTY_ICONS: Record<string, string> = {
  beginner: "🌱",
  intermediate: "🌿",
  advanced: "🌳",
};

export default function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
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

  const router = useRouter();
  const currentSceneData = scenes.find((s) => s.key === currentScene);
  const currentModelData = models.find((m) => m.key === currentModel);
  const currentDifficultyData = difficulties.find((d) => d.key === currentDifficulty);

  const handleCreateSession = async () => {
    const session = await createSession();
    if (session) {
      router.push("/practice");
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    await endSession();
    // Always navigate away from practice page — endSession always clears state
    router.push("/history");
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className={`
          fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden
          transition-opacity duration-300
          ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`
          h-full bg-gradient-to-b from-[#161821] via-[#1C1F2D] to-[#222638]
          flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0
          border-r border-white/5
          /* Desktop: normal flow */
          /* Mobile: fixed drawer overlay */
          fixed md:relative z-40 md:z-auto top-0 bottom-0 left-0
          ${sidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex-1 overflow-y-auto px-5 py-6 min-w-[288px] space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B4FCF]/15 to-[#9B8FFF]/10 border border-[#5B4FCF]/15 flex items-center justify-center shrink-0">
                <Settings2 className="w-4 h-4 text-[#9B8FFF]" />
              </div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-[0.1em]">
                练习控制台
              </p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

          {/* Scene Selection */}
          <div className="space-y-2.5">
            <SectionTitle icon={<Target className="w-3.5 h-3.5" />} text="练习场景" />
            <div className="space-y-2">
              {scenes.map((scene, idx) => {
                const isActive = currentScene === scene.key;
                return (
                  <button
                    key={scene.key}
                    onClick={() => setCurrentScene(scene.key)}
                    className={`
                      w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-200 text-left
                      ${isActive
                        ? "bg-gradient-to-r from-[#5B4FCF]/20 to-[#7C6FF7]/10 border border-[#5B4FCF]/30 text-white shadow-lg shadow-indigo-500/10"
                        : "text-white/55 border border-transparent hover:bg-white/5 hover:text-white/80"
                      }
                    `}
                  >
                    <span className="text-lg shrink-0">{scene.icon}</span>
                    <span className="flex-1 truncate">{scene.name}</span>
                    {isActive && <ChevronRight className="w-4 h-4 text-[#9B8FFF] shrink-0" />}
                    {!isActive && (
                      <span className="text-[10px] text-white/15 font-mono">{idx + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {currentSceneData && (
              <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                <p className="text-[11px] text-white/45 leading-relaxed">
                  {currentSceneData.description}
                </p>
              </div>
            )}
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-2.5">
            <SectionTitle icon={<Layers className="w-3.5 h-3.5" />} text="难度档位" />
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/3">
              {difficulties.map((d) => {
                const isActive = currentDifficulty === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setCurrentDifficulty(d.key)}
                    className={`
                      py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 relative
                      ${isActive
                        ? "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white shadow-lg shadow-indigo-500/25 scale-[1.02]"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }
                    `}
                  >
                    <span className="block text-sm mb-0.5">{DIFFICULTY_ICONS[d.key] || "📊"}</span>
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2.5">
            <SectionTitle icon={<Bot className="w-3.5 h-3.5" />} text="AI 模型" />
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/3">
              {models.map((m) => {
                const isActive = currentModel === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setCurrentModel(m.key)}
                    className={`
                      py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                      ${isActive
                        ? "bg-gradient-to-br from-[#C8956C]/30 to-[#E0B894]/20 text-white border border-[#C8956C]/40 shadow-lg shadow-amber-500/10"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }
                    `}
                  >
                    <span className="block text-base mb-0.5">{m.icon}</span>
                    {m.name}
                  </button>
                );
              })}
            </div>
            {currentModelData && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                <Sparkles className="w-3 h-3 text-amber-400/60 shrink-0" />
                <p className="text-[11px] text-white/40 italic leading-relaxed">
                  {currentModelData.description}
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Configuration Summary */}
          {!activeSession && currentSceneData && currentDifficultyData && currentModelData && (
            <div className="px-3 py-3 rounded-xl bg-gradient-to-r from-[#5B4FCF]/8 to-[#9B8FFF]/5 border border-[#5B4FCF]/12">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">
                  配置已就绪
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span>{currentSceneData.icon} {currentSceneData.name}</span>
                <span className="text-white/20">·</span>
                <span>{DIFFICULTY_ICONS[currentDifficulty] || "📊"} {currentDifficultyData.name}</span>
                <span className="text-white/20">·</span>
                <span>{currentModelData.icon} {currentModelData.name}</span>
              </div>
            </div>
          )}

          {/* Session Controls */}
          <div className="space-y-2.5">
            <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} text="会话管理" />
            <div className="space-y-2">
              <button
                onClick={handleCreateSession}
                className="group w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white
                           bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7]
                           shadow-lg shadow-indigo-500/25
                           hover:shadow-xl hover:shadow-indigo-500/35 hover:-translate-y-0.5
                           active:scale-[0.98]
                           transition-all duration-200
                           relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,transparent,50%,rgba(255,255,255,0.12),transparent,transparent)] translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                新建会话
              </button>
              <button
                onClick={handleEndSession}
                disabled={!activeSession}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                           text-white/55 bg-white/5 border border-white/8
                           hover:bg-white/10 hover:border-white/20 hover:text-white/80
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-200"
              >
                <StopCircle className="w-4 h-4" />
                结束会话
              </button>
            </div>
          </div>

          {/* Session Status */}
          {activeSession ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">进行中</p>
              </div>
              <p className="text-white/40 text-[11px] leading-relaxed">
                {activeSession.scene_name} · {activeSession.difficulty} · {activeSession.total_rounds} 轮对话
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#5B4FCF]/8 to-[#9B8FFF]/5 border border-[#5B4FCF]/15">
              <p className="text-[#9B8FFF] text-xs font-medium flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                点击「新建会话」开始练习
              </p>
            </div>
          )}

          {/* Report Button */}
          <div className="space-y-2.5">
            <SectionTitle icon={<BarChart3 className="w-3.5 h-3.5" />} text="学习报告" />
            <button
              onClick={() => router.push("/report")}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                         text-white/55 bg-white/5 border border-white/8
                         hover:bg-white/10 hover:border-white/20 hover:text-white/80
                         transition-all duration-200"
            >
              <ClipboardList className="w-4 h-4" />
              查看学习报告
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />
        </div>
      </aside>
    </>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30">{icon}</span>
      <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">
        {text}
      </h5>
    </div>
  );
}
