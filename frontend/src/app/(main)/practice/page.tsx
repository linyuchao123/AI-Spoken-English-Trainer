"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { sessionsApi, Message, ttsApi } from "@/lib/api";
import { Mic, Send, MicOff, Sparkles, Volume2, VolumeX } from "lucide-react";

/* ---------- Web Speech API Hook ---------- */
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

function playBase64Audio(base64: string, format = "mp3"): Promise<void> {
  return new Promise((resolve) => {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

function ChatBubble({
  message, isSpeaking, onSpeak,
}: { message: Message; isSpeaking: boolean; onSpeak: (id: number, text: string) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up group`}>
      <div className={`max-w-[75%] ${isUser ? "order-1" : ""}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] text-white rounded-br-md shadow-md shadow-indigo-200"
            : "bg-white border border-border text-text-primary rounded-bl-md shadow-sm"
        }`}>
          {message.content}
        </div>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? "justify-end" : ""}`}>
          <p className="text-[10px] text-text-light">{message.role === "user" ? "You" : "AI"}</p>
          {!isUser && (
            <button onClick={() => onSpeak(message.id, message.content)} disabled={isSpeaking}
              className={`p-0.5 rounded transition-all opacity-0 group-hover:opacity-100 ${
                isSpeaking ? "text-primary animate-pulse" : "text-text-light/50 hover:text-primary hover:bg-primary/10"
              }`}
              title={isSpeaking ? "播放中..." : "朗读"}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const { scenes, difficulties, currentScene, currentDifficulty, activeSession } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<Record<number, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();

  // Sync speech transcript to input
  useEffect(() => { if (speech.transcript) setInput(speech.transcript); }, [speech.transcript]);

  // Auto-send when speech stops and has content
  useEffect(() => {
    if (!speech.isListening && speech.transcript.trim() && activeSession) {
      const timer = setTimeout(() => {
        handleSendWithText(speech.transcript.trim());
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [speech.isListening]);

  const scene = scenes.find((s) => s.key === currentScene);
  const difficulty = difficulties.find((d) => d.key === currentDifficulty);

  useEffect(() => {
    if (activeSession) {
      sessionsApi.getMessages(activeSession.id).then(({ data }) => setMessages(data)).catch(() => setMessages([]));
    } else setMessages([]);
  }, [activeSession]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => handleSendWithText(input);

  const handleSendWithText = async (text: string) => {
    if (!text.trim() || !activeSession || sending) return;
    const t = text.trim(); if (t === input.trim()) setInput("");
    setSending(true);
    try { const { data } = await sessionsApi.sendMessage(activeSession.id, t); setMessages(data); }
    catch (err) { console.error("Failed to send message:", err); }
    finally { setSending(false); }
  };

  const handleSpeak = async (msgId: number, text: string) => {
    if (speakingMap[msgId]) return;
    setSpeakingMap((prev) => ({ ...prev, [msgId]: true }));
    try { const { data } = await ttsApi.speak(text); await playBase64Audio(data.audio_base64, data.format); }
    catch (err) { console.error("TTS playback failed:", err); }
    finally { setSpeakingMap((prev) => ({ ...prev, [msgId]: false })); }
  };

  if (!activeSession) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-lg animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#5B4FCF]/20 to-[#7C6FF7]/20 flex items-center justify-center mx-auto mb-6 animate-float">
            <Mic className="w-10 h-10 text-[#5B4FCF]" />
          </div>
          <h2 className="text-2xl font-extrabold text-text-primary mb-2">Ready to Practice?</h2>
          <p className="text-text-secondary text-sm mb-8 leading-relaxed">
            Select a scene and difficulty from the sidebar, then click{" "}
            <span className="font-semibold text-[#5B4FCF]">「New Session」</span>{" "}
            to start your English speaking practice.
          </p>
          <div className="bg-white rounded-2xl border border-border p-6 text-left shadow-sm">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C8956C]" /> How it works
            </h3>
            {["Type your English message and send", "Click speaker icon to hear AI reply aloud",
              "Click the microphone button to start speaking", "End the session for a detailed report"]
              .map((step, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{i + 1}</div>
                  <p className="text-sm text-text-secondary leading-relaxed">{step}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gradient-to-r from-[#1A1D28] to-[#2A2E3D] px-6 py-3 flex items-center gap-3 shrink-0">
        <span className="text-lg">{scene?.icon || "💬"}</span>
        <div>
          <h3 className="text-white text-sm font-bold">{scene?.name || "Practice"} · {difficulty?.name || ""}</h3>
          <p className="text-white/50 text-[11px]">{scene?.description || ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">Live</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && <div className="text-center py-12 text-text-light text-sm">Start the conversation! Type a message below.</div>}
        {messages.map((msg) => <ChatBubble key={msg.id} message={msg} isSpeaking={!!speakingMap[msg.id]} onSpeak={handleSpeak} />)}
        {sending && (
          <div className="flex items-center gap-2 text-text-light text-sm">
            <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="px-6 pb-4 pt-2 shrink-0 border-t border-border/50 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          {/* Mic Button */}
          {speech.isSupported ? (
            <button onClick={speech.isListening ? speech.stop : speech.start}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg
                transition-all duration-300 ${
                  speech.isListening
                    ? "bg-red-500 animate-pulse shadow-red-200 scale-110"
                    : "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-200 hover:scale-105 active:scale-95"
                }`}
              title={speech.isListening ? "Stop recording" : "Start voice input"}
            >
              {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          ) : (
            <button disabled
              className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white shadow-md cursor-not-allowed opacity-60"
              title="Speech recognition not supported in this browser"
            >
              <MicOff className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 relative">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={speech.isListening ? "🎤 Listening... speak now" : "Type or use mic to speak..."}
              className={`w-full px-4 py-3 pr-12 rounded-full border bg-white text-sm focus:outline-none
                transition-all placeholder:text-text-light ${
                  speech.isListening
                    ? "border-red-400 ring-2 ring-red-400/20"
                    : "border-border focus:ring-2 focus:ring-[#5B4FCF]/20 focus:border-[#5B4FCF]"
                }`}
            />
            <button onClick={handleSend} disabled={!input.trim() || sending}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#5B4FCF] text-white flex items-center justify-center hover:bg-[#4338CA] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-text-light mt-2">
          {speech.error
            ? `⚠️ Speech error: ${speech.error} — try again or type manually`
            : speech.isListening
              ? "🎤 Recording... click mic again to stop and auto-send"
              : "Click 🎤 to speak · Hover AI messages to listen · Press Enter to send"}
        </p>
      </div>
    </div>
  );
}
