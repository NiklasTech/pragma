import { describe, expect, it } from "vite-plus/test";

import { isStaleTerminal, staleTerminalIds } from "./staleTerminals";

const none = () => false;

describe("isStaleTerminal", () => {
  it("marks a standalone terminal that is neither open nor running", () => {
    expect(isStaleTerminal({ id: "t", kind: "terminal" }, new Set(), none)).toBe(true);
  });

  it("keeps terminals that are open in a pane or still running", () => {
    expect(isStaleTerminal({ id: "t", kind: "terminal" }, new Set(["t"]), none)).toBe(false);
    expect(isStaleTerminal({ id: "t", kind: "terminal" }, new Set(), () => true)).toBe(false);
  });

  it("never marks conversations or terminals that belong to a parent", () => {
    expect(isStaleTerminal({ id: "a", kind: "agent" }, new Set(), none)).toBe(false);
    expect(isStaleTerminal({ id: "c", kind: "terminal", parentId: "p" }, new Set(), none)).toBe(
      false,
    );
  });
});

describe("staleTerminalIds", () => {
  it("lists only the stale sessions", () => {
    const sessions = [
      { id: "open", kind: "terminal" as const },
      { id: "old", kind: "terminal" as const },
      { id: "chat", kind: "ask" as const },
    ];
    expect(staleTerminalIds(sessions, new Set(["open"]), none)).toEqual(["old"]);
  });
});
