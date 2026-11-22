import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";
import type { Space } from "@/shared/stores/spaces/model";

import {
  countByState,
  filterTiles,
  overviewTiles,
  sinceLabel,
  snippetLines,
  type OverviewInput,
} from "./overviewModel";

const NOW = 1_000_000_000;

const session = (id: string, extra: Partial<ChatSession> = {}): ChatSession => ({
  id,
  rootPath: "/repo",
  title: id,
  messages: [],
  createdAt: 0,
  updatedAt: NOW - 1000,
  kind: "agent",
  ...extra,
});

const space = (id: string, folder: string): Space => ({
  id,
  name: id,
  folders: [folder],
  tabs: [],
  activeTabId: "",
});

const input = (extra: Partial<OverviewInput>): OverviewInput => ({
  sessions: [],
  entries: {},
  spaces: [space("s1", "/repo"), space("s2", "/other")],
  liveTerminals: new Set(),
  openSessions: new Set(),
  now: NOW,
  ...extra,
});

describe("overviewTiles", () => {
  it("keeps sessions with a state, live CLIs and recent chats, never shells or empty chats", () => {
    const tiles = overviewTiles(
      input({
        sessions: [
          session("asked"),
          session("cli", { kind: "terminal", cliProviderId: "anthropic-claude" }),
          session("dead-cli", { kind: "terminal", cliProviderId: "anthropic-claude" }),
          session("shell", { kind: "terminal", cliProviderId: "shell" }),
          session("chat", { messages: [{ id: "m", role: "user", content: "hi", timestamp: 0 }] }),
          session("old-chat", {
            updatedAt: 0,
            messages: [{ id: "m", role: "user", content: "hi", timestamp: 0 }],
          }),
          session("empty"),
          session("archived", { archived: true }),
        ],
        entries: {
          asked: { state: "needs-you", seen: false, changedAt: NOW - 5 },
          archived: { state: "working", seen: true, changedAt: NOW },
        },
        liveTerminals: new Set(["cli", "shell"]),
      }),
    );
    expect(tiles.map((tile) => [tile.session.id, tile.state])).toEqual([
      ["asked", "needs-you"],
      ["cli", "idle"],
      ["chat", "idle"],
    ]);
    expect(tiles[0].spaceId).toBe("s1");
  });

  it("keeps a CLI that sits in a pane before its terminal has started", () => {
    const tiles = overviewTiles(
      input({
        sessions: [
          session("open-cli", { kind: "terminal", cliProviderId: "anthropic-claude" }),
          session("closed-cli", { kind: "terminal", cliProviderId: "anthropic-claude" }),
          session("open-shell", { kind: "terminal", cliProviderId: "shell" }),
        ],
        openSessions: new Set(["open-cli", "open-shell"]),
      }),
    );
    expect(tiles.map((tile) => [tile.session.id, tile.state])).toEqual([["open-cli", "idle"]]);
  });

  it("orders by urgency, the oldest question first", () => {
    const tiles = overviewTiles(
      input({
        sessions: [session("w"), session("q2"), session("q1"), session("d")],
        entries: {
          w: { state: "working", seen: true, changedAt: NOW },
          q2: { state: "needs-you", seen: false, changedAt: NOW - 1 },
          q1: { state: "needs-you", seen: false, changedAt: NOW - 9 },
          d: { state: "done", seen: false, changedAt: NOW },
        },
      }),
    );
    expect(tiles.map((tile) => tile.session.id)).toEqual(["q1", "q2", "w", "d"]);
  });
});

describe("filters", () => {
  it("filters by state and space and counts every state", () => {
    const tiles = overviewTiles(
      input({
        sessions: [session("a"), session("b", { rootPath: "/other" })],
        entries: {
          a: { state: "working", seen: true, changedAt: NOW },
          b: { state: "done", seen: false, changedAt: NOW },
        },
      }),
    );
    expect(filterTiles(tiles, { filter: "done", spaceId: null }).map((t) => t.session.id)).toEqual([
      "b",
    ]);
    expect(filterTiles(tiles, { filter: "all", spaceId: "s1" }).map((t) => t.session.id)).toEqual([
      "a",
    ]);
    expect(countByState(tiles)).toEqual({ all: 2, "needs-you": 0, working: 1, done: 1, idle: 0 });
  });
});

describe("snippetLines", () => {
  it("shows the output above a CLI's input box", () => {
    const screen = [
      "● Running the diff tests next.",
      "",
      "  Bash(cargo test)",
      "  ⎿  Waiting for permission",
      "─".repeat(40),
      "> ",
      "─".repeat(40),
      "  auto mode on",
    ];
    expect(snippetLines(screen, 3)).toEqual([
      "● Running the diff tests next.",
      "  Bash(cargo test)",
      "  ⎿  Waiting for permission",
    ]);
    expect(snippetLines(["$ ls", "a b", "", ""], 5)).toEqual(["$ ls", "a b"]);
  });

  it("labels time since a change", () => {
    expect(sinceLabel(NOW - 10_000, NOW)).toBe("now");
    expect(sinceLabel(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(sinceLabel(NOW - 3 * 3_600_000, NOW)).toBe("3h");
  });
});
