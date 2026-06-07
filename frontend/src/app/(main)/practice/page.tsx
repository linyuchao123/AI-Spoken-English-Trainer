"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { sessionsApi, Message, ttsApi } from "@/lib/api";
import { Mic, Send, MicOff, Sparkles, Volume2, Bot, User, MessageSquare } from "lucide-react";

/* ──────────── Scene background helper ──────────── */
function getSceneBg(sceneKey: string, difficulty: string): string {
  return `/scenes/${sceneKey}/${difficulty}.png`;
}

/* ──────────── Web Speech Recognition Hook ──────────── */
interface SpeechState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string;
}

function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>({
    isListening: false, isSupported: false, transcript: "", error: "",
  });
  const recognitionRef = useRef<any>(null);
  const shouldRestart = useRef(false);
  const finalTextRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setState((s) => ({ ...s, isSupported: false })); return; }
    setState((s) => ({ ...s, isSupported: true }));

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) { finalTextRef.current += " " + r[0].transcript; }
        else { interim += r[0].transcript; }
      }
      const display = (finalTextRef.current + " " + interim).trim();
      setState((s) => ({ ...s, transcript: display }));
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setState((s) => ({ ...s, error: event.error, isListening: false }));
    };

    recognition.onend = () => {
      if (shouldRestart.current) {
        try { recognition.start(); } catch { /* already started */ }
      } else {
        setState((s) => ({ ...s, isListening: false }));
      }
    };

    recognitionRef.current = recognition;
    return () => {
      shouldRestart.current = false;
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = true;
    finalTextRef.current = "";
    setState((s) => ({ ...s, isListening: true, error: "", transcript: "" }));
    try { rec.start(); } catch { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = false;
    setState((s) => ({ ...s, isListening: false }));
    try { rec.stop(); } catch { /* ignore */ }
  }, []);

  return { ...state, start, stop };
}

/* ──────────── TTS Audio Player ──────────── */
function playBase64Audio(base64: string, format = "mp3"): Promise<void> {
  return new Promise((resolve) => {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/* ══════════════════════════════════════════════════════════════
   Chat Bubble Component
   ══════════════════════════════════════════════════════════════ */
function ChatBubble({
  message, isSpeaking, isAutoPlaying, onReplay,
  userInitial, sceneKey,
}: {
  message: Message;
  isSpeaking: boolean;
  isAutoPlaying: boolean;
  onReplay: (id: number, text: string) => void;
  userInitial: string;
  sceneKey: string;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-slide-up">
        <div className="max-w-[72%]">
          <div className="px-5 py-3 rounded-2xl rounded-br-md text-sm leading-relaxed
                          bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white
                          shadow-lg shadow-indigo-500/20">
            {message.content}
          </div>
        </div>
        {/* User avatar */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8956C] to-[#E0B894]
                        flex items-center justify-center text-white text-sm font-bold
                        shadow-md shadow-amber-500/15 shrink-0 mt-1">
          {userInitial}
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-3 animate-slide-up">
      {/* AI avatar */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                      border border-white/10 flex items-center justify-center
                      shadow-lg shrink-0 mt-1">
        <Bot className="w-4.5 h-4.5 text-[#9B8FFF]" />
      </div>

      <div className="max-w-[72%]">
        <div className="px-5 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed
                        bg-white/90 backdrop-blur-sm border border-white/20
                        text-[#1E293B] shadow-md">
          {message.content}
        </div>
        <div className="flex items-center gap-2 mt-1.5 ml-1">
          {isAutoPlaying ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#5B4FCF]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B4FCF] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#5B4FCF]" />
              </span>
              播放中
            </span>
          ) : (
            <button
              onClick={() => onReplay(message.id, message.content)}
              disabled={isSpeaking}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                          transition-all duration-200 ${
                            isSpeaking
                              ? "text-text-light/30 cursor-not-allowed"
                              : "text-text-light/60 hover:text-[#5B4FCF] hover:bg-[#5B4FCF]/8"
                          }`}
              title="点击重新播放"
            >
              <Volume2 className="w-3 h-3" />
              重播
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   No Session View
   ══════════════════════════════════════════════════════════════ */
function NoSessionView() {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-[#FAFAF8] to-[#F0F0EB]">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#5B4FCF]/15 to-[#7C6FF7]/10
                        border border-[#5B4FCF]/15 flex items-center justify-center mx-auto mb-6
                        animate-float shadow-lg shadow-indigo-500/5">
          <MessageSquare className="w-12 h-12 text-[#5B4FCF]/60" />
        </div>
        <h2 className="text-2xl font-extrabold text-text-primary mb-3">
          开始你的英语对话之旅
        </h2>
        <p className="text-text-secondary text-sm mb-8 leading-relaxed">
          在左侧控制台选择场景与难度，点击
          <span className="font-bold text-[#5B4FCF] mx-1">「新建会话」</span>
          即可开始 AI 陪练
        </p>
        <div className="grid grid-cols-3 gap-3 text-left">
          {[
            { icon: "💬", title: "选场景", desc: "职场/餐厅/会议" },
            { icon: "🎯", title: "定难度", desc: "初级/中级/高级" },
            { icon: "✨", title: "开练", desc: "AI 即刻陪练" },
          ].map((item) => (
            <div key={item.title}
              className="p-3.5 rounded-2xl bg-white border border-border/60 shadow-sm
                         hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs font-bold text-text-primary">{item.title}</div>
              <div className="text-[10px] text-text-light mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Practice Page
   ══════════════════════════════════════════════════════════════ */
export default function PracticePage() {
  const { scenes, difficulties, activeSession, endSession } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<Record<number, boolean>>({});
  const [autoPlayedIds, setAutoPlayedIds] = useState<Set<number>>(new Set());
  const [autoPlayingId, setAutoPlayingId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scene = scenes.find((s) => s.key === activeSession?.scene_key);
  const difficulty = difficulties.find((d) => d.key === activeSession?.difficulty);
  const sceneKey = activeSession?.scene_key || "job_interview";
  const bgImage = getSceneBg(sceneKey, activeSession?.difficulty || "beginner");
  const userInitial = user?.username?.charAt(0).toUpperCase() || "U";

  // Sync speech transcript to input
  useEffect(() => { if (speech.transcript) setInput(speech.transcript); }, [speech.transcript]);

  // Auto-send when speech stops and has content
  useEffect(() => {
    if (!speech.isListening && speech.transcript.trim() && activeSession) {
      const timer = setTimeout(() => {
        handleSendWithText(speech.transcript.trim());
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [speech.isListening]);

  // Load messages when session changes
  useEffect(() => {
    if (activeSession) {
      sessionsApi.getMessages(activeSession.id).then(({ data }) => {
        setMessages(data);
        setAutoPlayedIds(new Set());
      }).catch(() => setMessages([]));
    } else {
      setMessages([]);
    }
  }, [activeSession?.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-play TTS for the last AI message
  useEffect(() => {
    const lastAiMsg = [...messages].reverse().find((m) => m.role === "ai");
    if (!lastAiMsg || autoPlayedIds.has(lastAiMsg.id)) return;

    setAutoPlayedIds((prev) => new Set(prev).add(lastAiMsg.id));
    autoSpeak(lastAiMsg.id, lastAiMsg.content);
  }, [messages]);

  const handleSend = () => handleSendWithText(input);

  const handleSendWithText = async (text: string) => {
    if (!text.trim() || !activeSession || sending) return;
    const t = text.trim();
    if (t === input.trim()) setInput("");
    setSending(true);
    try {
      const { data } = await sessionsApi.sendMessage(activeSession.id, t);
      setMessages(data);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const autoSpeak = async (msgId: number, text: string) => {
    setAutoPlayingId(msgId);
    try {
      const { data } = await ttsApi.speak(text);
      await playBase64Audio(data.audio_base64, data.format);
    } catch (err) {
      console.error("TTS playback failed:", err);
    } finally {
      setAutoPlayingId(null);
    }
  };

  const handleReplay = async (msgId: number, text: string) => {
    if (speakingMap[msgId]) return;
    setSpeakingMap((prev) => ({ ...prev, [msgId]: true }));
    try {
      const { data } = await ttsApi.speak(text);
      await playBase64Audio(data.audio_base64, data.format);
    } catch (err) {
      console.error("TTS playback failed:", err);
    } finally {
      setSpeakingMap((prev) => ({ ...prev, [msgId]: false }));
    }
  };

  const handleEndSession = async () => {
    await endSession();
    window.location.href = "/history";
  };

  if (!activeSession) return <NoSessionView />;

  const roundCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="h-full flex flex-col relative">
      {/* ── Scene Background ── */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1119]/85 via-[#1A1D28]/75 to-[#2A2E3D]/90" />
        {/* Subtle grain/vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,17,25,0.6)_100%)]" />
      </div>

      {/* ── Session Header ── */}
      <div className="relative z-10 flex items-center gap-4 px-6 py-3.5 shrink-0
                      bg-gradient-to-r from-[#1A1D28]/90 to-[#232738]/90 backdrop-blur-md
                      border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5B4FCF]/30 to-[#9B8FFF]/20
                          border border-[#5B4FCF]/20 flex items-center justify-center shadow-lg">
            <span className="text-xl">{scene?.icon || "💬"}</span>
          </div>
          <div>
            <h3 className="text-white text-sm font-bold leading-tight">
              {scene?.name || "Practice"}
              <span className="text-white/40 font-normal"> · {difficulty?.name || ""}</span>
            </h3>
            <p className="text-white/35 text-[11px] leading-tight mt-0.5">
              {scene?.description || ""}
            </p>
          </div>
        </div>

        {/* Round counter */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
            <MessageSquare className="w-3.5 h-3.5 text-[#9B8FFF]" />
            <span className="text-white/60 text-xs font-medium">{roundCount} 轮对话</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10
                              flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#9B8FFF]/60" />
              </div>
              <p className="text-white/40 text-sm">AI 正在准备对话...</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isSpeaking={!!speakingMap[msg.id]}
            isAutoPlaying={autoPlayingId === msg.id}
            onReplay={handleReplay}
            userInitial={userInitial}
            sceneKey={sceneKey}
          />
        ))}

        {/* Sending indicator */}
        {sending && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1D28] to-[#2A2E3D]
                            border border-white/10 flex items-center justify-center shadow-lg">
              <Bot className="w-4.5 h-4.5 text-[#9B8FFF]" />
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#9B8FFF] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="relative z-10 shrink-0 px-6 pb-5 pt-3
                      bg-gradient-to-t from-[#1A1D28]/95 via-[#1A1D28]/80 to-transparent
                      backdrop-blur-sm">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          {/* Mic Button */}
          {speech.isSupported ? (
            <button
              onClick={speech.isListening ? speech.stop : speech.start}
              disabled={sending}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white
                          shadow-lg transition-all duration-300 ${
                            speech.isListening
                              ? "bg-red-500 animate-pulse shadow-red-500/30"
                              : "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-500/25 hover:scale-105 active:scale-95"
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
              title={speech.isListening ? "停止录音" : "开始语音输入"}
            >
              {speech.isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </button>
          ) : (
            <button
              disabled
              className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 cursor-not-allowed"
              title="浏览器不支持语音识别"
            >
              <MicOff className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={speech.isListening ? "🎤 正在聆听... 请说英语" : "输入英语或点击麦克风语音输入..."}
              disabled={sending || speech.isListening}
              className={`w-full px-5 py-3 pr-12 rounded-2xl text-sm
                          bg-white/8 border backdrop-blur-sm text-white
                          placeholder:text-white/30 focus:outline-none
                          transition-all duration-200 ${
                            speech.isListening
                              ? "border-red-400/50 ring-2 ring-red-400/10"
                              : "border-white/10 focus:border-[#5B4FCF]/50 focus:ring-2 focus:ring-[#5B4FCF]/10"
                          }`}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl
                         bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] text-white
                         flex items-center justify-center
                         hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105
                         active:scale-95
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
                         transition-all duration-200"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-center text-[10px] text-white/25 mt-2.5 max-w-3xl mx-auto">
          {speech.error
            ? `⚠️ 语音错误: ${speech.error} — 请重试或手动输入`
            : speech.isListening
              ? "🎤 录音中... 再次点击麦克风停止并自动发送"
              : "点击 🎤 语音输入 · AI 消息自动朗读 · 点击 重播 可再次收听 · 按 Enter 发送"}
        </p>
      </div>
    </div>
  );
}
