export interface SpeechRecognitionAlternative {
  transcript: string;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

export const VOICE_INPUT_UNSUPPORTED = "Voice input is not supported on this platform.";
export const VOICE_INPUT_DENIED = "Microphone access was denied.";
export const VOICE_INPUT_NO_MICROPHONE = "No microphone was found.";
export const VOICE_INPUT_NO_SPEECH = "No speech was detected.";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const speech = window as SpeechRecognitionWindow;
  return Boolean(speech.SpeechRecognition ?? speech.webkitSpeechRecognition);
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const speech = window as SpeechRecognitionWindow;
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition ?? null;
}

export function createSpeechRecognition(
  lang: string,
  ctor: SpeechRecognitionCtor | null = getSpeechRecognitionCtor(),
): SpeechRecognition | null {
  if (!ctor) {
    return null;
  }
  const recognition = new ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

// Only final results commit text; interim results are never inserted.
export function extractFinalTranscript(event: SpeechRecognitionResultEvent): string {
  let transcript = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal && result.length > 0) {
      transcript += result[0].transcript;
    }
  }
  return transcript;
}

// Map engine error codes to one-line copy; unknown codes stay silent.
export function recognitionErrorCopy(error: string): string | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return VOICE_INPUT_DENIED;
    case "audio-capture":
      return VOICE_INPUT_NO_MICROPHONE;
    case "no-speech":
      return VOICE_INPUT_NO_SPEECH;
    default:
      return null;
  }
}
