"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import {
  Mic,
  Home,
  MessageSquare,
  History,
  Target,
  Wrench,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Volume2,
  AudioLines,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "首页", icon: Home },
  { href: "/practice", label: "语音对话", icon: MessageSquare },
  { href: "/history", label: "历史会话", icon: History },
  { href: "/pronunciation", label: "发音评测", icon: Target },
  { href: "/grammar", label: "语法纠错", icon: Wrench },
  { href: "/asr", label: "语音识别", icon: AudioLines },
  { href: "/tts", label: "语音合成", icon: Volume2 },
  { href: "/report", label: "课后总结", icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <nav className="h-16 bg-gradient-to-r from-[#1A1D28] via-[#1F2235] to-[#1A1D28] flex items-center px-6 gap-4 shrink-0 shadow-xl z-50 border-b border-white/5">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="w-5 h-5" />
        ) : (
          <PanelLeft className="w-5 h-5" />
        )}
      </button>

      {/* Brand */}
      <Link href="/home" className="flex items-center gap-2.5 mr-6 shrink-0 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B4FCF] to-[#9B8FFF] flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
          <Mic className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-white font-extrabold text-lg tracking-tight hidden sm:block">
          AI <span className="bg-gradient-to-r from-[#9B8FFF] to-[#C8956C] bg-clip-text text-transparent">Spoken English</span> Trainer
        </span>
      </Link>

      {/* Nav items */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                transition-all duration-200
                ${
                  isActive
                    ? "bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white shadow-lg shadow-indigo-500/25 scale-105"
                    : "text-white/55 hover:text-white hover:bg-white/8"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 shrink-0">
        {user && (
          <div className="flex items-center gap-2.5">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 shadow-md"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8956C] to-[#E0B894] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-amber-500/20">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white/70 text-sm font-medium hidden sm:block">
              {user.username}
            </span>
          </div>
        )}
        <button
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
