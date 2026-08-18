import { describe, expect, it } from "vite-plus/test";
import {
  loadPersistedBreakpoints,
  mapDapEvent,
  sameLines,
  toFileBreakpoints,
  toggleBreakpointLine,
} from "./debugState";

describe("toggleBreakpointLine", () => {
  it("adds a breakpoint to a new file", () => {
    const result = toggleBreakpointLine({}, "/a.ts", 3);
    expect(result).toEqual({ "/a.ts": [3] });
  });

  it("keeps lines sorted when adding", () => {
    const result = toggleBreakpointLine({ "/a.ts": [10] }, "/a.ts", 4);
    expect(result["/a.ts"]).toEqual([4, 10]);
  });

  it("removes an existing breakpoint", () => {
    const result = toggleBreakpointLine({ "/a.ts": [4, 10] }, "/a.ts", 4);
    expect(result["/a.ts"]).toEqual([10]);
  });

  it("drops the file entry when the last breakpoint is removed", () => {
    const result = toggleBreakpointLine({ "/a.ts": [4], "/b.ts": [1] }, "/a.ts", 4);
    expect(result).toEqual({ "/b.ts": [1] });
  });
});

describe("sameLines", () => {
  it("compares line lists", () => {
    expect(sameLines([1, 2], [1, 2])).toBe(true);
    expect(sameLines([1, 2], [2, 1])).toBe(false);
    expect(sameLines([1], [1, 2])).toBe(false);
  });
});

describe("toFileBreakpoints", () => {
  it("skips files without breakpoints", () => {
    const result = toFileBreakpoints({ "/a.ts": [1], "/b.ts": [] });
    expect(result).toEqual([{ path: "/a.ts", lines: [1] }]);
  });
});

describe("mapDapEvent", () => {
  it("maps stopped events with thread id and reason", () => {
    const effect = mapDapEvent({
      event: "stopped",
      body: { reason: "breakpoint", threadId: 7 },
    });
    expect(effect).toEqual({ isStopped: true, stoppedThreadId: 7, stopReason: "breakpoint" });
  });

  it("tolerates stopped events without a thread id", () => {
    const effect = mapDapEvent({ event: "stopped", body: { reason: "pause" } });
    expect(effect.isStopped).toBe(true);
    expect(effect.stoppedThreadId).toBeNull();
  });

  it("maps continued events when all threads continued", () => {
    expect(mapDapEvent({ event: "continued", body: { threadId: 1 } })).toEqual({
      isStopped: false,
      stoppedThreadId: null,
    });
    expect(
      mapDapEvent({ event: "continued", body: { threadId: 1, allThreadsContinued: false } }),
    ).toEqual({});
  });

  it("maps terminated and exited events to session end", () => {
    expect(mapDapEvent({ event: "terminated" }).sessionEnded).toBe(true);
    expect(mapDapEvent({ event: "exited", body: { exitCode: 0 } }).sessionEnded).toBe(true);
  });

  it("maps output events to console output", () => {
    const effect = mapDapEvent({
      event: "output",
      body: { category: "stdout", output: "hello\n" },
    });
    expect(effect).toEqual({ appendOutput: "hello\n" });
    expect(mapDapEvent({ event: "output", body: {} })).toEqual({});
  });

  it("ignores unknown events", () => {
    expect(mapDapEvent({ event: "breakpoint", body: {} })).toEqual({});
    expect(mapDapEvent({ event: "initialized" })).toEqual({});
  });
});

describe("breakpoint persistence", () => {
  it("returns an empty map when localStorage is unavailable", () => {
    expect(loadPersistedBreakpoints()).toEqual({});
  });
});
