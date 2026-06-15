import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string;
  volume: number;
}

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    isSupported: false,
    transcript: "",
    error: "",
    volume: 0,
  });
  const recognitionRef = useRef<any>(null);
  const shouldRestart = useRef(false);
  const finalTextRef = useRef("");
  const volumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState((s) => ({ ...s, isSupported: false }));
      return;
    }
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
        if (r.isFinal) {
          finalTextRef.current += " " + r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      const display = (finalTextRef.current + " " + interim).trim();
      setState((s) => ({ ...s, transcript: display }));
    };

    recognition.onspeechstart = () => setState((s) => ({ ...s, volume: 0.7 }));
    recognition.onspeechend = () => setState((s) => ({ ...s, volume: 0.3 }));
    recognition.onaudiostart = () => setState((s) => ({ ...s, volume: 0.5 }));

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setState((s) => ({ ...s, error: event.error, isListening: false, volume: 0 }));
    };

    recognition.onend = () => {
      if (shouldRestart.current) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      } else {
        setState((s) => ({ ...s, isListening: false, volume: 0 }));
      }
    };

    recognitionRef.current = recognition;
    return () => {
      shouldRestart.current = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Simulate volume fluctuation while listening
  useEffect(() => {
    if (state.isListening) {
      volumeIntervalRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          volume: Math.max(0.15, Math.min(0.95, 0.5 + Math.random() * 0.4)),
        }));
      }, 120);
    } else {
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
    }
    return () => {
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    };
  }, [state.isListening]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = true;
    finalTextRef.current = "";
    setState((s) => ({ ...s, isListening: true, error: "", transcript: "", volume: 0.3 }));
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    shouldRestart.current = false;
    setState((s) => ({ ...s, isListening: false, volume: 0 }));
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { ...state, start, stop };
}
