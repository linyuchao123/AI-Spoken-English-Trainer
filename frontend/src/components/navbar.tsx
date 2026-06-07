"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import {
  Mic,
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
    <nav className="h-14 bg-[#1A1D28] flex items-center px-4 gap-3 shrink-0 shadow-lg z-50">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="w-5 h-5" />
        ) : (
          <PanelLeft className="w-5 h-5" />
        )}
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2 mr-4">
        <Mic className="w-5 h-5 text-[#5B4FCF]" />
        <span className="text-white font-bold text-sm hidden sm:block">
          AI English Trainer
        </span>
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200
                ${
                  isActive
                    ? "bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white shadow-md shadow-indigo-500/25"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C8956C] to-[#E0B894] flex items-center justify-center text-white text-xs font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-white/80 text-xs font-medium hidden sm:block">
              {user.username}
            </span>
          </div>
        )}
        <button
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors"
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
