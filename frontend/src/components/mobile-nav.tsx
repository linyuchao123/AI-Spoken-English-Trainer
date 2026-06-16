"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  History,
  BarChart3,
  Settings2,
} from "lucide-react";

const MOBILE_NAV_ITEMS = [
  { href: "/home", label: "首页", icon: Home },
  { href: "/practice", label: "对话", icon: MessageSquare },
  { href: "/history", label: "历史", icon: History },
  { href: "/report", label: "报告", icon: BarChart3 },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#5B4FCF]/30 to-transparent" />

      <div className="bg-[#1A1D28]/98 backdrop-blur-xl border-t border-white/5 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-around h-16 px-2">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/practice" && pathname.startsWith("/practice")) ||
              (item.href === "/history" && pathname.startsWith("/history")) ||
              (item.href === "/report" && pathname.startsWith("/report"));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl
                  transition-all duration-200 relative
                  ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  }
                `}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute top-0.5 w-4 h-0.5 rounded-full bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7]" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Safe area padding for notched devices */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
}
