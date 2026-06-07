"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Target, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { pronunciationApi, PronunciationResult, WordScore } from "@/lib/api";

/* ---------- Web Speech Recognition Hook ---------- */
function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      setRecognizedText(finalTranscript.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setRecognizedText("");
    setInterimText("");
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      setIsListening(false);
      setInterimText("");
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setRecognizedText("");
    setInterimText("");
  }, [stop]);

  return { isListening, recognizedText, interimText, start, stop, reset };
}

/* ---------- Score Gauge ---------- */
function ScoreGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const angle = (score / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-7 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-14 rounded-full border-[5px] border-gray-100"
          style={{ clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)" }} />
        <div className="absolute bottom-0 left-0 w-full h-14 rounded-full border-[5px] border-transparent"
          style={{
            clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)",
            borderTopColor: "transparent",
            borderRightColor: angle > 0 ? color : "transparent",
            borderBottomColor: color,
            borderLeftColor: angle < 0 ? color : "transparent",
            transform: `rotate(${angle}deg)`,
            transformOrigin: "center center",
          }} />
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
      <span className="text-[10px] text-text-light">{label}</span>
    </div>
  );
}

/* ---------- Word List ---------- */
function WordList({ words }: { words: WordScore[] }) {
  if (!words.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-text-primary mb-2">📝 逐词分析</h4>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, i) => {
          const hasError = w.error_type && w.error_type !== "None";
          return (
            <div key={i}
              className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                hasError
                  ? "bg-red-50 border-red-200 text-red-700"
                  : w.accuracy_score >= 90
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
              title={`${w.word}: ${w.accuracy_score}%${hasError ? ` (${w.error_type})` : ""}`}
            >
              {w.word}
              {hasError && <span className="ml-1 text-[9px] opacity-60">{w.error_type}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function PronunciationPage() {
  const [referenceText, setReferenceText] = useState("Hello, how are you doing today?");
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState("");
  const speech = useSpeechRecognition();

  const handleAssess = async () => {
    if (!speech.recognizedText || !referenceText.trim()) return;
    setAssessing(true);
    setError("");
    try {
      const { data } = await pronunciationApi.assess(speech.recognizedText, referenceText.trim());
      setResult(data);
      if (data.error) setError(data.error);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Assessment request failed");
    } finally {
      setAssessing(false);
    }
  };

  const resetAll = () => {
    speech.reset();
    setResult(null);
    setError("");
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#10b981";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary mb-2">🎯 发音评测</h1>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          输入标准文本，点击麦克风朗读，AI 对比分析你的发音准确度、流利度、完整度。
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
        <label className="text-xs font-semibold text-text-primary mb-2 block">
          参考文本 Reference Text
        </label>
        <textarea
          value={referenceText}
          onChange={(e) => setReferenceText(e.target.value)}
          rows={3}
          placeholder="Enter the sentence you'll read aloud..."
          className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-primary text-sm
                     placeholder:text-text-light/60 resize-none focus:outline-none focus:border-primary/40
                     focus:ring-2 focus:ring-primary/10 transition-all"
        />

        {/* Speech Recognition Controls */}
        <div className="flex items-center justify-center gap-4 mt-5">
          {!speech.recognizedText && !speech.isListening ? (
            <button onClick={speech.start}
              className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg
                         bg-gradient-to-r from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
            >
              <Mic className="w-4 h-4" /> 开始朗读
            </button>
          ) : speech.isListening ? (
            <button onClick={speech.stop}
              className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg
                         bg-red-500 animate-pulse shadow-red-200 scale-105 transition-all"
            >
              <MicOff className="w-4 h-4" /> 停止录音
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={handleAssess} disabled={assessing}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white
                           bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-200
                           hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
                {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {assessing ? "AI 分析中..." : "开始评估"}
              </button>
              <button onClick={resetAll}
                className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold
                           text-text-secondary bg-white border border-border hover:bg-bg-main transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> 重新朗读
              </button>
            </div>
          )}
        </div>

        {speech.isListening && (
          <div className="mt-3 space-y-1">
            <p className="text-center text-xs text-red-500 animate-pulse">
              🎤 正在听... 请朗读上方参考文本
            </p>
            {speech.interimText && (
              <p className="text-center text-xs text-gray-400 italic">
                {speech.interimText}
              </p>
            )}
          </div>
        )}
        {speech.recognizedText && !speech.isListening && !assessing && !result && (
          <div className="mt-3 space-y-2">
            <p className="text-center text-xs text-emerald-600">
              ✅ 识别完成！点击「开始评估」
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              <p className="text-xs font-semibold text-emerald-700 mb-1">🎙️ 识别结果：</p>
              <p className="text-sm text-emerald-800">{speech.recognizedText}</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-800 text-sm font-semibold">评估提示</p>
            <p className="text-amber-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm animate-fade-in space-y-5">
          {/* Overall Score */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-[6px]"
              style={{ borderColor: getScoreColor(result.overall_score) + "40" }}>
              <div>
                <p className="text-3xl font-black" style={{ color: getScoreColor(result.overall_score) }}>
                  {Math.round(result.overall_score)}
                </p>
                <p className="text-[10px] text-text-light -mt-1">综合</p>
              </div>
            </div>
          </div>

          {/* Score Gauges */}
          <div className="flex justify-center gap-8">
            <ScoreGauge label="准确度" score={result.accuracy_score} color={getScoreColor(result.accuracy_score)} />
            <ScoreGauge label="流利度" score={result.fluency_score} color={getScoreColor(result.fluency_score)} />
            <ScoreGauge label="完整度" score={result.completeness_score} color={getScoreColor(result.completeness_score)} />
          </div>

          {/* Word-level feedback */}
          <WordList words={result.words} />

          {/* Score Legend */}
          <div className="flex justify-center gap-4 text-[10px] text-text-light">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 优秀 ≥85</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 良好 ≥70</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 需提升</span>
          </div>
        </div>
      )}
    </div>
  );
}
