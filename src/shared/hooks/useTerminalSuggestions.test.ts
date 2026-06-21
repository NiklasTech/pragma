import { describe, expect, it } from "vite-plus/test";

import { appendInput } from "./useTerminalSuggestions";

describe("appendInput", () => {
  it("appends printable characters", () => {
    expect(appendInput("git", " comm")).toBe("git comm");
  });

  it("handles backspace", () => {
    expect(appendInput("git comm", "\u007f")).toBe("git com");
  });

  it("resets on newline", () => {
    expect(appendInput("git comm", "\r")).toBe("");
    expect(appendInput("git comm", "\n")).toBe("");
  });

  it("ignores ANSI escape sequences", () => {
    expect(appendInput("git", "\u001b[A")).toBe("git");
    expect(appendInput("git", "\u001b[3~")).toBe("git");
  });

  it("ignores tab characters", () => {
    expect(appendInput("git", "\t")).toBe("git");
  });

  it("resets on Ctrl+C", () => {
    expect(appendInput("git comm", "\u0003")).toBe("");
  });

  it("caps input length", () => {
    const long = "a".repeat(600);
    expect(appendInput("", long).length).toBe(512);
  });
});
