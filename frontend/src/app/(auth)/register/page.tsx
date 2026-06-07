"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/lib/api";
import Link from "next/link";
import { Mic, Mail, Lock, User, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !email || !password || !confirm) {
      setError("请填写所有字段。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要6位字符。");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }

    setLoading(true);
    try {
      await register(email, username, password);
      router.push("/practice");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    setGithubLoading(true);
    window.location.href = authApi.githubLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-lg shadow-indigo-200 mb-4">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] tracking-tight">
            创建账号
          </h1>
          <p className="text-[#64748B] text-sm mt-1">
            注册开始你的AI英语口语之旅
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-[#E8ECF1] p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* GitHub Login Button */}
          <button
            type="button"
            onClick={handleGithubLogin}
            disabled={githubLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm border border-[#D0D5DD] bg-[#FAFBFC] hover:bg-[#F0F2F5] text-[#1E293B] transition-all flex items-center justify-center gap-3 mb-5 disabled:opacity-50"
          >
            {githubLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            )}
            {githubLoading ? "跳转中..." : "使用 GitHub 注册"}
          </button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8ECF1]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[#94A3B8]">或使用邮箱注册</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="你的名字"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4FCF]/20 focus:border-[#5B4FCF] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4FCF]/20 focus:border-[#5B4FCF] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">
                密码 (至少6位)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位字符"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4FCF]/20 focus:border-[#5B4FCF] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4FCF]/20 focus:border-[#5B4FCF] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-bold text-white text-sm bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  注册中...
                </>
              ) : (
                "注 册"
              )}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-[#64748B] mt-6">
          已有账号？{" "}
          <Link
            href="/login"
            className="text-[#5B4FCF] font-semibold hover:underline"
          >
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
