"use client";

import { useState, useRef, useCallback } from "react";

interface AudioRecorderState {
  isRecording: boolean;
  audioBase64: string | null;
  audioBlob: Blob | null;
  mimeType: string;
}

/**
 * Hook to record audio from the user's microphone using MediaRecorder API.
 * Sends raw browser-native audio (webm/opus or mp4) — Chivox MCP accepts
 * these formats directly, no transcoding needed.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    audioBase64: null,
    audioBlob: null,
    mimeType: "",
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const base64 = await _blobToBase64(blob);
        setState({
          isRecording: false,
          audioBase64: base64,
          audioBlob: blob,
          mimeType,
        });
        // Release microphone
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.onerror = () => {
        setState((s) => ({ ...s, isRecording: false }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState({ isRecording: true, audioBase64: null, audioBlob: null, mimeType });
    } catch (err) {
      console.error("[useAudioRecorder] Failed to start:", err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.requestData();
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setState((s) => ({ ...s, isRecording: false }));
  }, []);

  const reset = useCallback(() => {
    stop();
    chunksRef.current = [];
    setState({ isRecording: false, audioBase64: null, audioBlob: null, mimeType: "" });
  }, [stop]);

  return { ...state, start, stop, reset };
}

/* ── Helpers ─────────────────────────────────────────────── */

function _blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
