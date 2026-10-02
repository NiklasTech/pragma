import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { VoiceEngine } from "@/shared/stores/settings";
import {
  LIVE_INTERVAL_MS,
  createLocalDictation,
  type LocalDictationSession,
} from "./localDictation";
import { startPcmCapture } from "./pcmCapture";
import {
  VOICE_INPUT_DENIED,
  VOICE_INPUT_NO_MICROPHONE,
  VOICE_INPUT_UNSUPPORTED,
  createSpeechRecognition,
  extractSessionTranscript,
  recognitionErrorCopy,
  type SpeechRecognition,
} from "./webSpeech";

export const VOICE_INPUT_WHISPER_MISSING = "Download Whisper in Settings";
export const VOICE_INPUT_WHISPER_UNAVAILABLE = "Whisper is not available on this platform";
export const VOICE_INPUT_PARAKEET_MISSING = "Download Parakeet in Settings";
export const VOICE_INPUT_PARAKEET_UNAVAILABLE = "Parakeet is not available on this platform";
export const VOICE_INPUT_NO_MIC_ACCESS = "Could not access the microphone.";
export const VOICE_INPUT_NEEDS_APP_BUNDLE =
  "Voice input needs the installed Pragma app; development builds cannot ask for microphone access.";

export interface SttStatus {
  supported: boolean;
  installed: boolean;
}

type LocalEngine = Exclude<VoiceEngine, "web-speech">;

const LOCAL_ENGINES: Record<
  LocalEngine,
  { status: string; transcribe: string; missing: string; unavailable: string }
> = {
  whisper: {
    status: "stt_status",
    transcribe: "stt_transcribe",
    missing: VOICE_INPUT_WHISPER_MISSING,
    unavailable: VOICE_INPUT_WHISPER_UNAVAILABLE,
  },
  parakeet: {
    status: "parakeet_status",
    transcribe: "parakeet_transcribe",
    missing: VOICE_INPUT_PARAKEET_MISSING,
    unavailable: VOICE_INPUT_PARAKEET_UNAVAILABLE,
  },
};

export interface UseComposerDictationOptions {
  engine: VoiceEngine;
  /** Catalog id of the model the local engine runs. */
  model: string;
  enabled: boolean;
  /** The whole transcript of the current dictation; `final` marks its last update. */
  onText: (text: string, final: boolean) => void;
}

export interface UseComposerDictationResult {
  recording: boolean;
  busy: boolean;
  status: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** Microphone level 0..1 while a local engine records; returns an unsubscribe function. */
  subscribeLevel: (listener: LevelListener) => () => void;
}

export type LevelListener = (level: number) => void;

interface LocalRecording {
  stream: MediaStream;
  context: AudioContext;
  session: LocalDictationSession;
  timer: number;
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

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

export function useComposerDictation({
  engine,
  model,
  enabled,
  onText,
}: UseComposerDictationOptions): UseComposerDictationResult {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const modelRef = useRef(model);
  modelRef.current = model;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const localRef = useRef<LocalRecording | null>(null);
  const levelListenersRef = useRef(new Set<LevelListener>());

  const emitLevel = useCallback((level: number) => {
    levelListenersRef.current.forEach((listener) => listener(level));
  }, []);

  const subscribeLevel = useCallback((listener: LevelListener) => {
    levelListenersRef.current.add(listener);
    return () => {
      levelListenersRef.current.delete(listener);
    };
  }, []);

  const startWebSpeech = useCallback(() => {
    const recognition = createSpeechRecognition(navigator.language || "en-US");
    if (!recognition) {
      activeRef.current = false;
      setStatus(VOICE_INPUT_UNSUPPORTED);
      return;
    }
    recognitionRef.current = recognition;
    let transcript = "";
    recognition.onresult = (event) => {
      transcript = extractSessionTranscript(event);
      onTextRef.current(transcript, false);
    };
    recognition.onerror = (event) => {
      const copy = recognitionErrorCopy(event.error);
      if (copy) {
        setStatus(copy);
      }
    };
    recognition.onend = () => {
      onTextRef.current(transcript, true);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        activeRef.current = false;
        setRecording(false);
      }
    };
    setRecording(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      activeRef.current = false;
      setRecording(false);
      setStatus(VOICE_INPUT_UNSUPPORTED);
    }
  }, []);

  const startLocal = useCallback(
    async (localEngine: LocalEngine, model: string, context: AudioContext) => {
      const config = LOCAL_ENGINES[localEngine];
      const abort = (message: string | null) => {
        void context.close().catch(() => undefined);
        activeRef.current = false;
        if (message) setStatus(message);
      };

      let engineStatus: SttStatus;
      try {
        engineStatus = await invoke<SttStatus>(config.status, { model });
      } catch {
        engineStatus = { supported: true, installed: false };
      }
      if (!engineStatus.supported) {
        abort(config.unavailable);
        return;
      }
      if (!engineStatus.installed) {
        abort(config.missing);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        abort(mediaErrorCopy(error));
        return;
      }
      if (!activeRef.current) {
        stopStream(stream);
        abort(null);
        return;
      }

      try {
        await context.resume();
        if (!activeRef.current) {
          stopStream(stream);
          abort(null);
          return;
        }
        const capture = startPcmCapture(context, stream, emitLevel);
        const session = createLocalDictation({
          capture,
          transcribe: (wavBase64) => invoke<string>(config.transcribe, { wavBase64, model }),
          onText: (text, final) => onTextRef.current(text, final),
          onError: setStatus,
        });
        const timer = window.setInterval(session.tick, LIVE_INTERVAL_MS);
        localRef.current = { stream, context, session, timer };
        setRecording(true);
      } catch {
        stopStream(stream);
        abort(VOICE_INPUT_NO_MIC_ACCESS);
      }
    },
    [emitLevel],
  );

  const start = useCallback(() => {
    if (!enabledRef.current || activeRef.current) {
      return;
    }
    activeRef.current = true;
    setStatus(null);
    const current = engineRef.current;
    const currentModel = modelRef.current;
    let context: AudioContext | null = null;
    if (current !== "web-speech") {
      // Created inside the click or key press so the webview lets it run.
      try {
        context = new AudioContext();
      } catch {
        activeRef.current = false;
        setStatus(VOICE_INPUT_NO_MIC_ACCESS);
        return;
      }
    }
    void (async () => {
      const available = await invoke<boolean>("voice_input_available").catch(() => false);
      if (!available || !activeRef.current) {
        void context?.close().catch(() => undefined);
        activeRef.current = false;
        if (!available) setStatus(VOICE_INPUT_NEEDS_APP_BUNDLE);
        return;
      }
      if (current === "web-speech") {
        startWebSpeech();
      } else if (context) {
        await startLocal(current, currentModel, context);
      }
    })();
  }, [startLocal, startWebSpeech]);

  const stop = useCallback(() => {
    if (!activeRef.current) {
      return;
    }
    activeRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // The session already ended through an error event.
      }
      return;
    }
    const local = localRef.current;
    localRef.current = null;
    setRecording(false);
    if (!local) {
      return;
    }
    window.clearInterval(local.timer);
    stopStream(local.stream);
    emitLevel(0);
    setBusy(true);
    void local.session.finish().finally(() => {
      void local.context.close().catch(() => undefined);
      setBusy(false);
    });
  }, [emitLevel]);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    stop();
  }, [engine, model, stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
    }
  }, [enabled, stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onend = null;
        try {
          recognition.abort();
        } catch {
          // Nothing left to cancel.
        }
      }
      const local = localRef.current;
      localRef.current = null;
      if (local) {
        window.clearInterval(local.timer);
        local.session.cancel();
        stopStream(local.stream);
        void local.context.close().catch(() => undefined);
      }
    },
    [],
  );

  return { recording, busy, status, start, stop, toggle, subscribeLevel };
}
