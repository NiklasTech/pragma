import { describe, expect, it } from "vite-plus/test";

import type { AgentState } from "@/shared/components/ui/status-dot";
import type { ChatSession } from "@/shared/stores/ai";

import { earlierSessions, sheetGroups } from "./agentSheetGroups";
import type { RailEntry } from "./railEntries";

function session(id: string, title: string, updatedAt = 0, extra: Partial<ChatSession> = {}) {
  return { id, title, updatedAt, rootPath: "/test", createdAt: 0, ...extra } as ChatSession;
}

function entry(sessionId: string): RailEntry {
  return { sessionId, leafId: `leaf-${sessionId}`, tabId: "tab", tabNumber: 1 };
}

const states: Record<string, AgentState> = { a: "working", b: "needs-you", c: "idle" };
const sessions: Record<string, ChatSession> = {
  a: session("a", "fix login redirect"),
  b: session("b", "release build"),
  c: session("c", "zsh"),
};

describe("sheetGroups", () => {
  it("orders the panes by state and skips empty states", () => {
    const groups = sheetGroups(
      [entry("a"), entry("b"), entry("c")],
      (id) => states[id],
      (id) => sessions[id],
      "",
    );
    expect(groups.map((group) => group.state)).toEqual(["needs-you", "working", "idle"]);
  });

  it("keeps only titles that contain the filter", () => {
    const groups = sheetGroups(
      [entry("a"), entry("b"), entry("c")],
      (id) => states[id],
      (id) => sessions[id],
      " LOGIN ",
    );
    expect(groups).toEqual([{ state: "working", entries: [entry("a")] }]);
  });
});

describe("earlierSessions", () => {
  it("lists the newest threads no pane shows, without archived or child runs", () => {
    const list = earlierSessions(
      [
        session("old", "old", 1),
        session("new", "new", 3),
        session("shown", "shown", 5),
        session("archived", "archived", 4, { archived: true }),
        session("child", "child", 6, { parentId: "new" }),
      ],
      new Set(["shown"]),
      "",
    );
    expect(list.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
