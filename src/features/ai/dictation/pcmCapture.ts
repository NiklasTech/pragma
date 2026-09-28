import { resampleToRate } from "./wav";

export const DICTATION_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

export interface PcmCapture {
  /** Everything recorded so far as mono samples at 16 kHz. */
  snapshot: () => Float32Array;
  stop: () => void;
}

// ScriptProcessorNode instead of an AudioWorklet: the app CSP blocks worklet modules from blob URLs.
export function startPcmCapture(context: AudioContext, stream: MediaStream): PcmCapture {
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
  const chunks: Float32Array[] = [];
  let length = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    length += input.length;
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
