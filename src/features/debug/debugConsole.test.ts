import { describe, expect, it } from "vite-plus/test";
import {
  appendConsoleEntry,
  navigateConsoleHistory,
  outputEntryKind,
  pushConsoleHistory,
} from "./debugConsole";

describe("outputEntryKind", () => {
  it("maps stderr and falls back to stdout", () => {
    expect(outputEntryKind("stderr")).toBe("stderr");
    expect(outputEntryKind("console")).toBe("stdout");
    expect(outputEntryKind(undefined)).toBe("stdout");
  });
});

describe("appendConsoleEntry", () => {
  it("caps the number of entries", () => {
    let entries = appendConsoleEntry([], "input", "first");
    for (let i = 0; i < 600; i++) entries = appendConsoleEntry(entries, "stdout", String(i));
    expect(entries).toHaveLength(500);
    expect(entries[entries.length - 1].text).toBe("599");
  });
});

describe("pushConsoleHistory", () => {
  it("skips consecutive duplicates", () => {
    expect(pushConsoleHistory(["a"], "a")).toEqual(["a"]);
    expect(pushConsoleHistory(["a"], "b")).toEqual(["a", "b"]);
  });
});

describe("navigateConsoleHistory", () => {
  const history = ["a", "b", "c"];

  it("walks back from the fresh input and stops at the oldest entry", () => {
    let step = navigateConsoleHistory(history, null, "up");
    expect(step).toEqual({ index: 2, value: "c" });
    step = navigateConsoleHistory(history, 0, "up");
    expect(step).toEqual({ index: 0, value: "a" });
  });

  it("walks forward and returns to the fresh input", () => {
    expect(navigateConsoleHistory(history, 1, "down")).toEqual({ index: 2, value: "c" });
    expect(navigateConsoleHistory(history, 2, "down")).toEqual({ index: null, value: "" });
    expect(navigateConsoleHistory([], null, "up")).toEqual({ index: null, value: "" });
  });
});
