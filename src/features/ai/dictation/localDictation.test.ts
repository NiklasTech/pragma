import { describe, expect, it, vi } from "vite-plus/test";

import { createLocalDictation } from "./localDictation";
import type { PcmCapture } from "./pcmCapture";

function fakeCapture(): PcmCapture & { grow: (seconds: number) => void; stop: () => void } {
  let samples = new Float32Array(0);
  return {
    grow: (seconds) => {
      samples = new Float32Array(samples.length + seconds * 16000);
    },
    snapshot: () => samples,
    stop: vi.fn(),
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createLocalDictation", () => {
  it("shows live text while recording and commits the final transcript", async () => {
    const capture = fakeCapture();
    const transcribe = vi
      .fn<(wav: string) => Promise<string>>()
      .mockResolvedValueOnce(" Hallo ")
      .mockResolvedValueOnce("Hallo Welt.");
    const onText = vi.fn();
    const session = createLocalDictation({ capture, transcribe, onText, onError: vi.fn() });

    capture.grow(1);
    session.tick();
    await flush();
    expect(onText).toHaveBeenLastCalledWith("Hallo", false);

    capture.grow(1);
    await session.finish();
    expect(onText).toHaveBeenLastCalledWith("Hallo Welt.", true);
    expect(capture.stop).toHaveBeenCalled();
  });

  it("runs one live request at a time and waits for new audio", async () => {
    const capture = fakeCapture();
    let resolve: (text: string) => void = () => {};
    const transcribe = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const session = createLocalDictation({
      capture,
      transcribe,
      onText: vi.fn(),
      onError: vi.fn(),
    });

    capture.grow(1);
    session.tick();
    session.tick();
    expect(transcribe).toHaveBeenCalledTimes(1);
    resolve("a");
    await flush();
    session.tick();
    expect(transcribe).toHaveBeenCalledTimes(1);
  });

  it("keeps the last live text when the final transcription fails", async () => {
    const capture = fakeCapture();
    const transcribe = vi
      .fn<(wav: string) => Promise<string>>()
      .mockResolvedValueOnce("partial text")
      .mockRejectedValueOnce(new Error("Recording is too long"));
    const onText = vi.fn();
    const onError = vi.fn();
    const session = createLocalDictation({ capture, transcribe, onText, onError });

    capture.grow(1);
    session.tick();
    await flush();
    await session.finish();
    expect(onError).toHaveBeenCalledWith("Recording is too long");
    expect(onText).toHaveBeenLastCalledWith("partial text", true);
  });

  it("finishes empty recordings without transcribing", async () => {
    const capture = fakeCapture();
    const transcribe = vi.fn<(wav: string) => Promise<string>>();
    const onText = vi.fn();
    await createLocalDictation({ capture, transcribe, onText, onError: vi.fn() }).finish();
    expect(transcribe).not.toHaveBeenCalled();
    expect(onText).toHaveBeenCalledWith("", true);
  });
});
