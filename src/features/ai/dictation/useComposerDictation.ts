import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { VoiceEngine } from "@/shared/stores/settings";
import { arrayBufferToBase64, audioBufferToWav } from "./wav";
import {
  VOICE_INPUT_DENIED,
  VOICE_INPUT_NO_MICROPHONE,
  VOICE_INPUT_UNSUPPORTED,
  createSpeechRecognition,
  extractFinalTranscript,
  recognitionErrorCopy,
  type SpeechRecognition,
} from "./webSpeech";

export const VOICE_INPUT_WHISPER_MISSING = "Download Whisper in Settings";
export const VOICE_INPUT_WHISPER_UNAVAILABLE = "Whisper is not available on this platform";
export const VOICE_INPUT_NO_MIC_ACCESS = "Could not access the microphone.";

export interface SttStatus {
  supported: boolean;
  installed: boolean;
}

export interface UseComposerDictationOptions {
  engine: VoiceEngine;
  enabled: boolean;
  onTranscript: (text: string) => void;
}

export interface UseComposerDictationResult {
  recording: boolean;
  busy: boolean;
  status: string | null;
  toggle: () => void;
}

function mediaErrorCopy(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError") {
    return VOICE_INPUT_DENIED;
  }
  if (name === "NotFoundError") {
    return VOICE_INPUT_NO_MICROPHONE;
  }
  return VOICE_INPUT_NO_MIC_ACCESS;
}

function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

export function useComposerDictation({
  engine,
  enabled,
  onTranscript,
}: UseComposerDictationOptions): UseComposerDictationResult {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const finishRecording = useCallback(() => {
    activeRef.current = false;
    setRecording(false);
  }, []);

  const transcribeRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    recorderRef.current = null;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    finishRecording();
    if (!recorder || chunks.length === 0) {
      return;
    }

    setBusy(true);
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      let wav: ArrayBuffer;
      try {
        const decoded = await audioContext.decodeAudioData(arrayBuffer);
        wav = audioBufferToWav(decoded, 16000);
      } finally {
        await audioContext.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      const text = await invoke<string>("stt_transcribe", {
        wavBase64: arrayBufferToBase64(wav),
      });
      const trimmed = text.trim();
      if (trimmed) {
        onTranscriptRef.current(trimmed);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [finishRecording]);

  const startWebSpeech = useCallback(() => {
    const recognition = createSpeechRecognition(navigator.language || "en-US");
    if (!recognition) {
      activeRef.current = false;
      setStatus(VOICE_INPUT_UNSUPPORTED);
      return;
    }
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const text = extractFinalTranscript(event);
      if (text) {
        onTranscriptRef.current(text);
      }
    };
    recognition.onerror = (event) => {
      const copy = recognitionErrorCopy(event.error);
      if (copy) {
        setStatus(copy);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        finishRecording();
      }
    };
    setStatus(null);
    setRecording(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      activeRef.current = false;
      setRecording(false);
      setStatus(VOICE_INPUT_UNSUPPORTED);
    }
  }, [finishRecording]);

  const startWhisper = useCallback(async () => {
    let whisper: SttStatus;
    try {
      whisper = await invoke<SttStatus>("stt_status");
    } catch {
      whisper = { supported: true, installed: false };
    }
    if (!whisper.supported) {
      activeRef.current = false;
      setStatus(VOICE_INPUT_WHISPER_UNAVAILABLE);
      return;
    }
    if (!whisper.installed) {
      activeRef.current = false;
      setStatus(VOICE_INPUT_WHISPER_MISSING);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      activeRef.current = false;
      setStatus(mediaErrorCopy(error));
      return;
    }
    if (!activeRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    const mimeType = pickRecorderMimeType();
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      activeRef.current = false;
      setStatus(VOICE_INPUT_NO_MIC_ACCESS);
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      void transcribeRecording();
    };
    recorderRef.current = recorder;
    setStatus(null);
    setRecording(true);
    recorder.start();
  }, [transcribeRecording]);

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // The session already ended through an error event.
      }
      finishRecording();
      return;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      finishRecording();
    }
  }, [finishRecording]);

  const toggle = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    if (activeRef.current) {
      stopRecording();
      return;
    }
    activeRef.current = true;
    if (engineRef.current === "whisper") {
      void startWhisper();
    } else {
      startWebSpeech();
    }
  }, [startWhisper, startWebSpeech, stopRecording]);

  useEffect(() => {
    if (activeRef.current) {
      stopRecording();
    }
  }, [engine, stopRecording]);

  useEffect(() => {
    if (!enabled && activeRef.current) {
      stopRecording();
    }
  }, [enabled, stopRecording]);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // Nothing left to cancel.
        }
      }
      recognitionRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      recorderRef.current = null;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    },
    [],
  );

  return { recording, busy, status, toggle };
}
