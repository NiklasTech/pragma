import { DICTATION_SAMPLE_RATE, type PcmCapture } from "./pcmCapture";
import { arrayBufferToBase64, floatToPcm16, pcm16ToWav } from "./wav";

export const LIVE_INTERVAL_MS = 700;
const MIN_NEW_SAMPLES = DICTATION_SAMPLE_RATE / 2;

export type Transcribe = (wavBase64: string) => Promise<string>;

export interface LocalDictationOptions {
  capture: PcmCapture;
  transcribe: Transcribe;
  /** The whole session transcript so far; `final` marks the last call. */
  onText: (text: string, final: boolean) => void;
  onError: (message: string) => void;
}

export interface LocalDictationSession {
  /** Re-transcribes the recording so far; called on an interval while recording. */
  tick: () => void;
  finish: () => Promise<void>;
  cancel: () => void;
}

function encode(samples: Float32Array): string {
  return arrayBufferToBase64(pcm16ToWav(floatToPcm16(samples), DICTATION_SAMPLE_RATE));
}

// Local engines are not streaming models, so the growing recording is re-transcribed while the
// user speaks. At most one live request runs at a time, which keeps slow machines from queuing.
export function createLocalDictation({
  capture,
  transcribe,
  onText,
  onError,
}: LocalDictationOptions): LocalDictationSession {
  let stopped = false;
  let liveRequest = false;
  let transcribedLength = 0;
  let lastText = "";

  return {
    tick: () => {
      if (stopped || liveRequest) return;
      const samples = capture.snapshot();
      if (samples.length - transcribedLength < MIN_NEW_SAMPLES) return;
      transcribedLength = samples.length;
      liveRequest = true;
      transcribe(encode(samples))
        .then((text) => {
          if (stopped) return;
          lastText = text.trim();
          onText(lastText, false);
        })
        .catch(() => undefined)
        .finally(() => {
          liveRequest = false;
        });
    },
    finish: async () => {
      stopped = true;
      const samples = capture.snapshot();
      capture.stop();
      if (samples.length === 0) {
        onText("", true);
        return;
      }
      try {
        onText((await transcribe(encode(samples))).trim(), true);
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
        onText(lastText, true);
      }
    },
    cancel: () => {
      stopped = true;
      capture.stop();
    },
  };
}
