import { describe, expect, it } from "vite-plus/test";

import { arrayBufferToBase64, floatToPcm16, pcm16ToWav } from "./wav";

function readHeader(wav: ArrayBuffer) {
  const view = new DataView(wav);
  const stringAt = (offset: number, length: number) =>
    String.fromCharCode(...new Uint8Array(wav, offset, length));
  return {
    riff: stringAt(0, 4),
    wave: stringAt(8, 4),
    fmt: stringAt(12, 4),
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    data: stringAt(36, 4),
    riffSize: view.getUint32(4, true),
    dataSize: view.getUint32(40, true),
  };
}

describe("pcm16ToWav", () => {
  it("writes a 16-bit mono PCM WAV header around the samples", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const wav = pcm16ToWav(pcm, 16000);
    expect(wav.byteLength).toBe(44 + pcm.byteLength);

    const header = readHeader(wav);
    expect(header.riff).toBe("RIFF");
    expect(header.wave).toBe("WAVE");
    expect(header.fmt).toBe("fmt ");
    expect(header.format).toBe(1);
    expect(header.channels).toBe(1);
    expect(header.sampleRate).toBe(16000);
    expect(header.byteRate).toBe(16000 * 2);
    expect(header.blockAlign).toBe(2);
    expect(header.bitsPerSample).toBe(16);
    expect(header.data).toBe("data");
    expect(header.riffSize).toBe(36 + pcm.byteLength);
    expect(header.dataSize).toBe(pcm.byteLength);

    const roundTrip = new Int16Array(wav, 44);
    expect(Array.from(roundTrip)).toEqual(Array.from(pcm));
  });

  it("supports non-16k sample rates in the header", () => {
    const wav = pcm16ToWav(new Int16Array(0), 48000);
    expect(readHeader(wav).sampleRate).toBe(48000);
  });
});

describe("floatToPcm16", () => {
  it("scales and clamps float samples to int16", () => {
    const pcm = floatToPcm16(new Float32Array([0, 0.5, -0.5, 1, -1, 2]));
    expect(Array.from(pcm)).toEqual([0, 16383, -16384, 32767, -32768, 32767]);
  });
});

describe("arrayBufferToBase64", () => {
  it("encodes binary data without stack overflow on large buffers", () => {
    const bytes = new Uint8Array(100000);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 251;
    }
    const encoded = arrayBufferToBase64(bytes.buffer);
    expect(encoded.length).toBeGreaterThan(100000);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
