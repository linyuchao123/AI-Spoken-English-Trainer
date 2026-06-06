"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Copy, Trash2, Volume2 } from "lucide-react";

/* ---------- Speech Recognition Hook ---------- */
function useSpeechRecognition(lang = "en-US") {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const shouldRestart = useRef(false);
  const finalText = useRef("");
  const langRef = useRef(lang);

  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setIsSupported(false); return; }
    setIsSupported(true);

    const rec = new SR();
    rec.lang = langRef.current;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText.current += " " + e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setFinalTranscript(finalText.current.trim());
      setInterimTranscript(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error); setIsListening(false);
    };
    rec.onend = () => {
      if (shouldRestart.current) {
        try { rec.start(); } catch { /* */ }
      } else setIsListening(false);
    };
    recognitionRef.current = rec;
    return () => { shouldRestart.current = false; try { rec.stop(); } catch { /* */ } };
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current; if (!rec) return;
    shouldRestart.current = true; finalText.current = "";
    setFinalTranscript(""); setInterimTranscript(""); setError("");
    setIsListening(true);
    try { rec.lang = langRef.current; rec.start(); } catch { /* */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current; if (!rec) return;
    shouldRestart.current = false; setIsListening(false);
    try { rec.stop(); } catch { /* */ }
  }, []);

  return { isListening, isSupported, finalTranscript, interimTranscript, error, start, stop };
}

/* ---------- Saved Transcripts ---------- */
function SavedList({ items, onReplay, onCopy, onDelete }: {
  items: string[]; onReplay: (t: string) => void; onCopy: (t: string) => void; onDelete: (i: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 animate-fade-in">
      <h3 className="text-sm font-bold text-text-primary mb-3">📝 History ({items.length})</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((t, i) => (
          <div key={i} className="flex items-start gap-2 bg-white border border-border rounded-xl p-3 group hover:shadow-sm transition-shadow">
            <p className="flex-1 text-sm text-text-secondary leading-relaxed">{t}</p>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => onReplay(t)} className="p-1 rounded hover:bg-primary/10 text-text-light hover:text-primary" title="Read aloud">
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onCopy(t)} className="p-1 rounded hover:bg-primary/10 text-text-light hover:text-primary" title="Copy">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(i)} className="p-1 rounded hover:bg-red-50 text-text-light hover:text-red-500" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function ASRPage() {
  const [lang, setLang] = useState("en-US");
  const [saved, setSaved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const speech = useSpeechRecognition(lang);

  const currentText = `${speech.finalTranscript} ${speech.interimTranscript}`.trim();

  const handleStopAndSave = () => {
    speech.stop();
    if (currentText) {
      setSaved((prev) => [currentText, ...prev].slice(0, 20));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400/20 to-rose-600/20 flex items-center justify-center mx-auto mb-4">
          <Mic className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary mb-2">🎤 语音识别 ASR</h1>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          使用浏览器内置 Web Speech API，免费、无需配置。推荐 Chrome / Edge。
        </p>
      </div>

      {/* Language Selector */}
      <div className="flex justify-center gap-2 mb-6">
        {[
          { key: "en-US", label: "🇺🇸 English" },
          { key: "en-GB", label: "🇬🇧 English (UK)" },
          { key: "zh-CN", label: "🇨🇳 中文" },
          { key: "ja-JP", label: "🇯🇵 日本語" },
        ].map((l) => (
          <button key={l.key} onClick={() => setLang(l.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              lang === l.key
                ? "bg-[#5B4FCF] text-white shadow-md shadow-indigo-200"
                : "bg-white border border-border text-text-secondary hover:border-[#5B4FCF]/30"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {!speech.isSupported ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center animate-fade-in">
          <p className="text-amber-800 text-sm font-semibold mb-1">⚠️ Browser not supported</p>
          <p className="text-amber-600 text-xs">Please use Chrome or Edge for speech recognition. Firefox/Safari have limited or no support.</p>
        </div>
      ) : (
        <>
          {/* Record Area */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 animate-fade-in">
            <div className="flex flex-col items-center gap-6">
              {/* Big Mic */}
              <button onClick={speech.isListening ? handleStopAndSave : speech.start}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-500 ${
                  speech.isListening
                    ? "bg-red-500 animate-pulse shadow-red-300 scale-110"
                    : "bg-gradient-to-br from-[#5B4FCF] to-[#7C6FF7] shadow-indigo-300 hover:scale-105 active:scale-95"
                }`}
              >
                {speech.isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>

              {/* Status */}
              <div className="text-center">
                {speech.isListening ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-sm font-semibold text-red-500">Recording...</span>
                  </div>
                ) : currentText ? (
                  <span className="text-xs text-text-light">Click mic to record again</span>
                ) : (
                  <span className="text-sm text-text-light">Click the mic and start speaking</span>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="mt-6 min-h-[80px] p-4 bg-bg-main rounded-xl border border-border/50">
              {currentText ? (
                <p className="text-text-primary text-lg leading-relaxed">
                  {speech.finalTranscript}
                  {speech.interimTranscript && (
                    <span className="text-text-light italic"> {speech.interimTranscript}</span>
                  )}
                </p>
              ) : (
                <p className="text-text-light/40 text-sm italic">
                  {speech.isListening ? "Speak now — your words will appear here in real-time..." : "Your recognized speech will appear here..."}
                </p>
              )}
            </div>

            {/* Actions */}
            {currentText && !speech.isListening && (
              <div className="flex justify-center gap-3 mt-4 animate-fade-in">
                <button onClick={() => handleCopy(currentText)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors">
                  <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}

            {/* Error */}
            {speech.error && (
              <p className="mt-3 text-xs text-danger text-center bg-danger/5 rounded-lg py-2">
                ⚠️ {speech.error} — try again
              </p>
            )}
          </div>
        </>
      )}

      {/* Saved History */}
      <SavedList items={saved} onReplay={() => {}} onCopy={handleCopy} onDelete={(i) => setSaved((p) => p.filter((_, idx) => idx !== i))} />
    </div>
  );
}
