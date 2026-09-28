import { resampleToRate } from "./wav";

export const DICTATION_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

export interface PcmCapture {
  /** Everything recorded so far as mono samples at 16 kHz. */
  snapshot: () => Float32Array;
  stop: () => void;
}

/** Maps the RMS of a buffer to 0..1, with a square root so quiet speech still moves the meter. */
export function levelFromSamples(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(Math.sqrt(sum / samples.length)) * 2.2);
}

// ScriptProcessorNode instead of an AudioWorklet: the app CSP blocks worklet modules from blob URLs.
export function startPcmCapture(
  context: AudioContext,
  stream: MediaStream,
  onLevel?: (level: number) => void,
): PcmCapture {
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
  const chunks: Float32Array[] = [];
  let length = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    length += input.length;
    onLevel?.(levelFromSamples(input));
  };
  source.connect(processor);
  processor.connect(context.destination);

  return {
    snapshot: () => {
      const merged = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return resampleToRate(merged, context.sampleRate, DICTATION_SAMPLE_RATE);
    },
    stop: () => {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
    },
  };
}
