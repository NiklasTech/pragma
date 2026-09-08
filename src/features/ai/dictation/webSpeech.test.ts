import { describe, expect, it } from "vite-plus/test";

import {
  VOICE_INPUT_DENIED,
  VOICE_INPUT_NO_MICROPHONE,
  VOICE_INPUT_NO_SPEECH,
  VOICE_INPUT_UNSUPPORTED,
  createSpeechRecognition,
  extractFinalTranscript,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  recognitionErrorCopy,
  type SpeechRecognition,
  type SpeechRecognitionResultEvent,
} from "./webSpeech";

class FakeRecognition implements SpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: SpeechRecognition["onresult"] = null;
  onerror: SpeechRecognition["onerror"] = null;
  onend: SpeechRecognition["onend"] = null;
  start() {}
  stop() {}
  abort() {}
}

function resultEvent(
  entries: Array<{ text: string; isFinal: boolean }>,
): SpeechRecognitionResultEvent {
  const results = entries.map((entry) => ({
    isFinal: entry.isFinal,
    length: 1,
    0: { transcript: entry.text },
  }));
  return { resultIndex: 1, results: results as SpeechRecognitionResultEvent["results"] };
}

describe("webSpeech support", () => {
  it("reports no constructor in environments without the Web Speech API", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(getSpeechRecognitionCtor()).toBeNull();
  });

  it("returns null when no constructor is available", () => {
    expect(createSpeechRecognition("en-US", null)).toBeNull();
  });

  it("configures lang, continuous and interim results on the instance", () => {
    const recognition = createSpeechRecognition("de-DE", FakeRecognition);
    expect(recognition).not.toBeNull();
    expect(recognition?.lang).toBe("de-DE");
    expect(recognition?.continuous).toBe(true);
    expect(recognition?.interimResults).toBe(true);
  });

  it("exposes the exact one-line unsupported copy", () => {
    expect(VOICE_INPUT_UNSUPPORTED).toBe("Voice input is not supported on this platform.");
  });

  it("maps speech errors to one-line copy", () => {
    expect(recognitionErrorCopy("not-allowed")).toBe(VOICE_INPUT_DENIED);
    expect(recognitionErrorCopy("service-not-allowed")).toBe(VOICE_INPUT_DENIED);
    expect(recognitionErrorCopy("audio-capture")).toBe(VOICE_INPUT_NO_MICROPHONE);
    expect(recognitionErrorCopy("no-speech")).toBe(VOICE_INPUT_NO_SPEECH);
    expect(recognitionErrorCopy("language-not-supported")).toBeNull();
  });

  it("extracts only final transcripts from the result event", () => {
    const event = resultEvent([
      { text: "ignored", isFinal: true },
      { text: " hello", isFinal: true },
      { text: "partial", isFinal: false },
      { text: " world", isFinal: true },
    ]);
    expect(extractFinalTranscript(event)).toBe(" hello world");
  });

  it("skips interim-only events", () => {
    const event = resultEvent([{ text: "still thinking", isFinal: false }]);
    expect(extractFinalTranscript(event)).toBe("");
  });
});
