"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Volume2, Loader2, Play } from "lucide-react";
import { ttsApi, TTSResult } from "@/lib/api";

function playBase64Audio(base64: string, format = "mp3"): Promise<void> {
  return new Promise((resolve) => {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

export default function TTSPage() {
  const searchParams = useSearchParams();
  const [text, setText] = useState("");

  // Read text from URL query param (for pronunciation page jump)
  useEffect(() => {
    const textParam = searchParams.get("text");
    if (textParam) {
      setText(decodeURIComponent(textParam));
    }
  }, [searchParams]);
  const [voice, setVoice] = useState("default");
  const [provider, setProvider] = useState("edge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<TTSResult | null>(null);

  const handleSpeak = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await ttsApi.speak(text.trim(), voice, provider);
      setLastResult(data);
      await playBase64Audio(data.audio_base64, data.format);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "TTS synthesis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSpeak();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B4FCF]/20 to-[#7C6FF7]/20 flex items-center justify-center mx-auto mb-4">
          <Volume2 className="w-8 h-8 text-[#5B4FCF]" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary mb-2">
          🔊 语音合成 TTS
        </h1>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          输入英文文本，AI 将使用自然语音朗读（Edge TTS 免费）
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter English text to speak...&#10;e.g. Hello, welcome to AI English Trainer!"
          rows={4}
          className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                     placeholder:text-text-light/60 resize-none focus:outline-none focus:border-primary/40
                     focus:ring-2 focus:ring-primary/10 transition-all"
        />

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                         focus:outline-none focus:border-primary/40 cursor-pointer"
            >
              <option value="edge">Edge TTS (免费)</option>
              <option value="openai">OpenAI TTS</option>
              <option value="azure">Azure TTS</option>
            </select>

            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-bg-main border border-border rounded-lg px-3 py-2 text-xs text-text-secondary
                         focus:outline-none focus:border-primary/40 cursor-pointer"
            >
              <option value="default">默认声音</option>
              <option value="en-US-JennyNeural">Jenny (Female US)</option>
              <option value="en-US-AriaNeural">Aria (Female US)</option>
              <option value="en-US-GuyNeural">Guy (Male US)</option>
              <option value="en-GB-SoniaNeural">Sonia (Female UK)</option>
              <option value="en-GB-RyanNeural">Ryan (Male UK)</option>
            </select>
          </div>

          <button
            onClick={handleSpeak}
            disabled={loading || !text.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                       bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-md shadow-indigo-500/25
                       hover:shadow-lg hover:shadow-indigo-500/35 hover:-translate-y-0.5
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
                       transition-all duration-200"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {loading ? "生成中..." : "朗读"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-danger">{error}</p>
        )}
      </div>

      {/* Result */}
      {lastResult && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="text-xs font-semibold text-success">
                ✅ 生成完成
              </span>
            </div>
            <span className="text-[10px] text-text-light">
              {lastResult.provider} · {lastResult.voice} · {lastResult.format}
            </span>
          </div>
          <button
            onClick={() => playBase64Audio(lastResult.audio_base64, lastResult.format)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary/5 border border-primary/20
                       hover:bg-primary/10 transition-colors text-sm font-medium text-primary"
          >
            <Volume2 className="w-4 h-4" />
            重新播放
          </button>
        </div>
      )}
    </div>
  );
}
