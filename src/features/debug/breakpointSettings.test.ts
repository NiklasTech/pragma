import { describe, expect, it } from "vite-plus/test";
import {
  breakpointKind,
  loadPersistedBreakpointSettings,
  normalizeBreakpointSettings,
  remapFileSettings,
  sameMarkerSpecs,
  setLineSettings,
  toMarkerSpecs,
  toSourceBreakpoints,
} from "./breakpointSettings";

describe("normalizeBreakpointSettings", () => {
  it("trims values and drops empty ones", () => {
    expect(normalizeBreakpointSettings({ condition: " x > 1 ", hitCondition: "  " })).toEqual({
      condition: "x > 1",
    });
  });

  it("returns null when nothing is set", () => {
    expect(normalizeBreakpointSettings({ logMessage: "" })).toBeNull();
  });
});

describe("breakpointKind", () => {
  it("prefers logpoints over conditions", () => {
    expect(breakpointKind(undefined)).toBe("breakpoint");
    expect(breakpointKind({ hitCondition: "3" })).toBe("conditional");
    expect(breakpointKind({ condition: "x", logMessage: "hit" })).toBe("logpoint");
  });
});

describe("marker specs", () => {
  it("derives the kind per line", () => {
    const specs = toMarkerSpecs([2, 4], { 4: { logMessage: "hi" } });
    expect(specs).toEqual([
      { line: 2, kind: "breakpoint" },
      { line: 4, kind: "logpoint" },
    ]);
    expect(sameMarkerSpecs(specs, toMarkerSpecs([2, 4], {}))).toBe(false);
    expect(sameMarkerSpecs(specs, toMarkerSpecs([2, 4], { 4: { logMessage: "x" } }))).toBe(true);
  });
});

describe("toSourceBreakpoints", () => {
  it("merges settings into the lines", () => {
    expect(toSourceBreakpoints([1, 3], { 3: { condition: "ok" } })).toEqual([
      { line: 1 },
      { line: 3, condition: "ok" },
    ]);
  });
});

describe("setLineSettings", () => {
  it("adds and removes settings, dropping empty files", () => {
    const added = setLineSettings({}, "/a.ts", 3, { condition: "x" });
    expect(added).toEqual({ "/a.ts": { 3: { condition: "x" } } });
    expect(setLineSettings(added, "/a.ts", 3, null)).toEqual({});
  });
});

describe("remapFileSettings", () => {
  it("moves settings with shifted lines", () => {
    expect(remapFileSettings({ 5: { condition: "x" } }, [2, 5], [3, 6])).toEqual({
      6: { condition: "x" },
    });
  });

  it("keeps settings on surviving lines when the count changes", () => {
    expect(
      remapFileSettings({ 2: { condition: "a" }, 5: { condition: "b" } }, [2, 5], [5]),
    ).toEqual({ 5: { condition: "b" } });
  });
});

describe("breakpoint settings persistence", () => {
  it("returns an empty map when localStorage is unavailable", () => {
    expect(loadPersistedBreakpointSettings()).toEqual({});
  });
});
