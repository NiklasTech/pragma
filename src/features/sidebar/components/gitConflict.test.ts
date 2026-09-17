import { describe, expect, it } from "vite-plus/test";
import {
  acceptFileResolution,
  hasConflictMarkers,
  parseConflictHunks,
  resolveConflictContent,
} from "./gitConflict";

const CONFLICTED = [
  "before",
  "<<<<<<< HEAD",
  "ours one",
  "ours two",
  "=======",
  "theirs",
  ">>>>>>> feature",
  "middle",
  "<<<<<<< HEAD",
  "current b",
  "=======",
  "incoming b",
  ">>>>>>> feature",
  "after",
].join("\n");

describe("hasConflictMarkers", () => {
  it("detects conflict blocks", () => {
    expect(hasConflictMarkers(CONFLICTED)).toBe(true);
    expect(hasConflictMarkers("plain\ntext")).toBe(false);
  });
});

describe("parseConflictHunks", () => {
  it("parses both hunks with sides", () => {
    const hunks = parseConflictHunks(CONFLICTED);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({
      index: 0,
      startLine: 2,
      current: "ours one\nours two",
      incoming: "theirs",
      base: null,
    });
    expect(hunks[1]).toMatchObject({
      index: 1,
      startLine: 9,
      current: "current b",
      incoming: "incoming b",
    });
  });

  it("captures diff3 base sections", () => {
    const diff3 = [
      "<<<<<<< HEAD",
      "ours",
      "||||||| base",
      "origin",
      "=======",
      "theirs",
      ">>>>>>> x",
    ].join("\n");
    const [hunk] = parseConflictHunks(diff3);
    expect(hunk.base).toBe("origin");
    expect(hunk.current).toBe("ours");
    expect(hunk.incoming).toBe("theirs");
  });
});

describe("resolveConflictContent", () => {
  it("applies per-hunk choices and keeps unresolved markers", () => {
    const resolved = resolveConflictContent(CONFLICTED, { 0: "current" });
    expect(resolved).toBe(
      [
        "before",
        "ours one",
        "ours two",
        "middle",
        "<<<<<<< HEAD",
        "current b",
        "=======",
        "incoming b",
        ">>>>>>> feature",
        "after",
      ].join("\n"),
    );
  });

  it("resolves every hunk when all choices are present", () => {
    const resolved = resolveConflictContent(CONFLICTED, { 0: "incoming", 1: "incoming" });
    expect(resolved).toBe(["before", "theirs", "middle", "incoming b", "after"].join("\n"));
    expect(hasConflictMarkers(resolved)).toBe(false);
  });

  it("returns input untouched when there are no markers", () => {
    expect(resolveConflictContent("plain", {})).toBe("plain");
  });
});

describe("acceptFileResolution", () => {
  it("joins both sides for the both option", () => {
    expect(acceptFileResolution("a", "b", "both")).toBe("a\nb");
    expect(acceptFileResolution("a", "", "both")).toBe("a");
    expect(acceptFileResolution("a", "b", "incoming")).toBe("b");
  });
});
