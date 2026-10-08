import { describe, expect, it } from "vite-plus/test";

import { formatConsole, parseConsoleReply } from "./console";

const TIME = Date.UTC(2026, 9, 8, 12, 30, 5);

describe("parseConsoleReply", () => {
  it("reads the entries of the matching reply", () => {
    const reply = {
      type: "pragma:browser-console-result",
      id: "r1",
      url: "http://localhost:5173/",
      entries: [{ level: "error", text: "boom", time: TIME }, { level: 3 }, null],
    };
    expect(parseConsoleReply(reply, "r1")).toEqual({
      url: "http://localhost:5173/",
      entries: [{ level: "error", text: "boom", time: TIME }],
    });
  });

  it("ignores other messages and other requests", () => {
    expect(parseConsoleReply({ type: "other", id: "r1", entries: [] }, "r1")).toBeNull();
    expect(
      parseConsoleReply({ type: "pragma:browser-console-result", id: "r2", entries: [] }, "r1"),
    ).toBeNull();
    expect(parseConsoleReply("text", "r1")).toBeNull();
  });
});

describe("formatConsole", () => {
  const entries = [
    { level: "log", text: "ready", time: TIME },
    { level: "error", text: "TypeError: x is undefined", time: TIME },
    { level: "network", text: "404 GET /api/items", time: TIME },
  ];

  it("lists every entry with its time and level", () => {
    expect(formatConsole({ url: "http://localhost:5173/", entries }, 50)).toBe(
      [
        "Console of http://localhost:5173/, 3 entries (times in UTC):",
        "[12:30:05] log: ready",
        "[12:30:05] error: TypeError: x is undefined",
        "[12:30:05] network: 404 GET /api/items",
      ].join("\n"),
    );
  });

  it("keeps only the most recent entries within the limit", () => {
    const text = formatConsole({ url: "http://localhost:5173/", entries }, 1);
    expect(text.split("\n")).toEqual([
      "Console of http://localhost:5173/, the last 1 of 3 entries (times in UTC):",
      "[12:30:05] network: 404 GET /api/items",
    ]);
  });

  it("says so when the page recorded nothing", () => {
    expect(formatConsole({ url: "http://localhost:5173/", entries: [] }, 50)).toBe(
      "No console messages, errors or failed requests since http://localhost:5173/ loaded.",
    );
  });
});
