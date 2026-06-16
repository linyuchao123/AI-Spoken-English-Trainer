"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useAppStore } from "@/stores/app-store";
import {
  Mic,
  MessageSquare,
  Target,
  Wrench,
  BarChart3,
  Sparkles,
  Zap,
  Globe,
  ArrowRight,
  Play,
  Users,
  Star,
  TrendingUp,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "沉浸式场景对话",
    desc: "职场面试、餐厅点餐、商务会议三大真实场景，AI 角色扮演陪练",
    color: "from-indigo-500 to-purple-600",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Target,
    title: "智能发音评测",
    desc: "基于 LLM 的精准发音分析，逐词评分，即时纠音反馈",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Wrench,
    title: "语法实时纠错",
    desc: "AI 语法引擎检查每句话，中英双语解释，理解零障碍",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "课后学习报告",
    desc: "会话结束自动生成多维评估报告，跟踪进步轨迹",
    color: "from-rose-500 to-pink-600",
    bg: "bg-rose-500/10",
  },
];

const STATS = [
  { icon: Globe, value: "3", label: "真实场景" },
  { icon: Zap, value: "3", label: "难度档位" },
  { icon: Sparkles, value: "3", label: "AI 模型" },
  { icon: Users, value: "24/7", label: "随时练习" },
];

const SCENES = [
  { key: "job_interview", name: "职场面试", desc: "模拟英文工作面试，涵盖自我介绍、行为问题、薪资谈判", icon: "💼", gradient: "from-blue-600 to-indigo-700" },
  { key: "restaurant", name: "餐厅点餐", desc: "模拟英文餐厅场景，练习点餐、询问菜品、处理特殊需求", icon: "🍽️", gradient: "from-orange-600 to-red-700" },
  { key: "business_meeting", name: "商务会议", desc: "模拟英文商务会议，涵盖项目汇报、战略讨论、团队协作", icon: "📊", gradient: "from-teal-600 to-cyan-700" },
];

export default function HomePage() {
  const { createSession, loadConfig, configLoaded } = useAppStore();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!configLoaded) loadConfig();
  }, [configLoaded, loadConfig]);

  const handleQuickStart = async (sceneKey: string) => {
    await createSession();
    window.location.href = "/practice";
  };

  return (
    <div className="min-h-full">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-br from-[#0F1119] via-[#1A1D28] to-[#232738]"
      >
        {/* Animated background mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-600/5 blur-3xl animate-float" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-amber-500/8 to-rose-500/5 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-conic from-indigo-500/5 via-transparent to-amber-500/5 blur-2xl animate-pulse" style={{ animationDuration: "4s" }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-28">
          {/* Badge */}
          <div className="flex justify-center mb-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-white/70">AI-Powered English Speaking Practice</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6 animate-slide-up">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
              Master English
              <br />
              <span className="bg-gradient-to-r from-[#9B8FFF] via-[#C8956C] to-[#FFB088] bg-clip-text text-transparent">
                Through Conversation
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-center text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            与 AI 进行沉浸式英语对话练习 —— 多场景模拟、实时发音评估、
            精准语法纠正，让每一次开口都有进步。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-10 md:mb-16 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Link
              href="/practice"
              className="group flex items-center gap-2.5 px-7 py-3 md:px-8 md:py-3.5 rounded-2xl bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white font-bold text-base md:text-lg shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              开始练习
              <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
            </Link>
            <button
              onClick={() => handleQuickStart("job_interview")}
              className="flex items-center gap-2 px-6 py-3 md:px-7 md:py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm text-sm md:text-base"
            >
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
              快速开始 · 职场面试
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.6s" }}>
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-white/3 border border-white/5 backdrop-blur-sm">
                  <Icon className="w-5 h-5 text-white/40" />
                  <span className="text-2xl font-extrabold text-white">{stat.value}</span>
                  <span className="text-xs text-white/40">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="h-20 bg-gradient-to-t from-[#FAFAF8] to-transparent" />
      </div>

      {/* ── Features Section ── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-4">
            智能陪练，全方位提升
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            从发音到语法，从对话到报告，每一步都有 AI 为你保驾护航
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl bg-white border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bg} mb-4`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-br ${feature.color} bg-clip-text text-transparent`} />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Scenes Section ── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-4">
            选择场景，即刻开始
          </h2>
          <p className="text-text-secondary text-lg">
            三大真实英文场景，从初级到高级自由选择难度
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {SCENES.map((scene, i) => (
            <div
              key={scene.key}
              className="group relative overflow-hidden rounded-2xl bg-white border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${0.15 * i}s` }}
            >
              <div className={`h-2 bg-gradient-to-r ${scene.gradient}`} />
              <div className="p-6">
                <div className="text-4xl mb-3">{scene.icon}</div>
                <h3 className="text-xl font-bold text-text-primary mb-2">{scene.name}</h3>
                <p className="text-sm text-text-secondary mb-5 leading-relaxed">{scene.desc}</p>
                <Link
                  href="/practice"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B4FCF] hover:text-[#7C6FF7] transition-colors group/link"
                >
                  开始此场景
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 pb-24">
          <div className="relative rounded-3xl bg-gradient-to-br from-[#1A1D28] via-[#232738] to-[#2A2E3D] p-10 md:p-16 text-center overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-gradient-to-bl from-indigo-500/10 to-transparent blur-2xl" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-medium text-white/60">开始你的英语进阶之旅</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                准备好了吗？
              </h2>
              <p className="text-white/50 text-lg mb-8 max-w-lg mx-auto">
                选择场景和难度，AI 陪练即刻上线。每一次对话都是一次进步。
              </p>
              <Link
                href="/practice"
                className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white font-bold text-lg shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 hover:scale-105 transition-all duration-300"
              >
                <TrendingUp className="w-5 h-5" />
                立即开始对话练习
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
