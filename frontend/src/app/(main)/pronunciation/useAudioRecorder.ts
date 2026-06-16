"use client";

import { useState, useRef, useCallback } from "react";

interface AudioRecorderState {
  isRecording: boolean;
  /** WAV PCM 16-bit base64 (Chivox-compatible) */
  audioBase64: string | null;
  audioBlob: Blob | null;
  mimeType: string;
}

/**
 * Hook to record audio from the user's microphone using MediaRecorder API.
 *
 * The recorded audio is automatically converted to WAV (PCM 16-bit, 16kHz, mono)
 * which is compatible with Chivox MCP pronunciation assessment.
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

      // Use any format the browser supports; we'll convert to WAV on stop
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
        // Convert to WAV for Chivox compatibility
        const wavBase64 = await _convertToWavBase64(blob, 16000);
        setState({
          isRecording: false,
          audioBase64: wavBase64,
          audioBlob: blob,
          mimeType: "audio/wav",
        });
        // Release microphone
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.onerror = () => {
        setState((s) => ({ ...s, isRecording: false }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      // Collect chunks every 250ms for smooth finalisation
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
      // Request any remaining data before stopping
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

/* ── WAV Conversion ──────────────────────────────────────── */

/**
 * Convert an audio Blob (any format) to WAV PCM 16-bit mono at target sample rate.
 * Uses Web Audio API to decode, then re-encodes as WAV.
 * Falls back to raw base64 if conversion fails.
 */
async function _convertToWavBase64(blob: Blob, targetSampleRate: number): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate: targetSampleRate });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // If source is stereo, mix down to mono
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);
    if (numChannels === 1) {
      monoData.set(audioBuffer.getChannelData(0));
    } else {
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          sum += audioBuffer.getChannelData(ch)[i];
        }
        monoData[i] = sum / numChannels;
      }
    }

    // Resample if source rate differs from target
    let samples: Float32Array;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      samples = _resampleLinear(monoData, audioBuffer.sampleRate, targetSampleRate);
    } else {
      samples = monoData;
    }

    // Encode to WAV PCM 16-bit
    const wavBytes = _encodeWav(samples, targetSampleRate);
    audioCtx.close();
    return _arrayBufferToBase64(wavBytes);
  } catch (err) {
    console.warn("[useAudioRecorder] WAV conversion failed, sending raw:", err);
    // Fallback: send raw audio as base64
    return _blobToBase64(blob);
  }
}

function _resampleLinear(
  input: Float32Array,
  srcRate: number,
  dstRate: number,
): Float32Array {
  const ratio = srcRate / dstRate;
  const outLen = Math.round(input.length / ratio);
  const output = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = srcIdx - idx0;
    output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
  }
  return output;
}

function _encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  _writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  _writeString(view, 8, "WAVE");

  // fmt subchunk
  _writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);           // subchunk size
  view.setUint16(20, 1, true);            // PCM = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  _writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM samples (clamped to 16-bit range)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return buffer;
}

function _writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function _blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip "data:audio/webm;base64," prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
