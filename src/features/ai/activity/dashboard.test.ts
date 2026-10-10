import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import {
  countStates,
  engineLabel,
  formatStateDuration,
  groupByCategory,
  resolveDashboardState,
  trackStates,
  type DashboardItem,
  type DashboardState,
  type StateInput,
} from "./dashboard";

const quiet: StateInput = {
  running: new Set(),
  waiting: new Set(),
  terminalWorking: new Set(),
  outcomes: {},
};

function session(id: string, extra: Partial<ChatSession> = {}): ChatSession {
  return { id, title: id, messages: [], createdAt: 0, updatedAt: 100, ...extra };
}

function item(id: string, state: DashboardState, since: number, category?: string): DashboardItem {
  return { session: session(id, { category }), state, since };
}

describe("resolveDashboardState", () => {
  it("puts a pending approval before a running run", () => {
    const input = { ...quiet, running: new Set(["a"]), waiting: new Set(["a"]) };
    expect(resolveDashboardState("a", input)).toBe("waiting");
  });

  it("counts terminal output as work", () => {
    expect(resolveDashboardState("t", { ...quiet, terminalWorking: new Set(["t"]) })).toBe(
      "working",
    );
  });

  it("shows an unseen outcome until the session works again", () => {
    const outcomes = { a: "failed" as const };
    expect(resolveDashboardState("a", { ...quiet, outcomes })).toBe("failed");
    expect(resolveDashboardState("a", { ...quiet, outcomes, running: new Set(["a"]) })).toBe(
      "working",
    );
  });

  it("falls back to idle", () => {
    expect(resolveDashboardState("a", quiet)).toBe("idle");
  });
});

describe("trackStates", () => {
  it("dates a newly seen idle session from its last update", () => {
    const next = trackStates({}, [session("a")], quiet, 5_000);
    expect(next.a).toEqual({ state: "idle", since: 100 });
  });

  it("keeps the start time while the state holds", () => {
    const previous = { a: { state: "working" as const, since: 1_000 } };
    const next = trackStates(
      previous,
      [session("a")],
      { ...quiet, running: new Set(["a"]) },
      9_000,
    );
    expect(next).toBe(previous);
  });

  it("restarts the clock on a state change", () => {
    const previous = { a: { state: "working" as const, since: 1_000 } };
    const next = trackStates(previous, [session("a")], quiet, 9_000);
    expect(next.a).toEqual({ state: "idle", since: 9_000 });
  });

  it("drops sessions that no longer exist", () => {
    const previous = {
      a: { state: "idle" as const, since: 100 },
      b: { state: "idle" as const, since: 100 },
    };
    const next = trackStates(previous, [session("a")], quiet, 9_000);
    expect(Object.keys(next)).toEqual(["a"]);
  });
});

describe("groupByCategory", () => {
  it("sorts categories alphabetically with uncategorized sessions last", () => {
    const groups = groupByCategory([
      item("a", "idle", 0),
      item("b", "idle", 0, "Web"),
      item("c", "idle", 0, "Api"),
    ]);
    expect(groups.map((group) => group.category)).toEqual(["Api", "Web", null]);
  });

  it("lists sessions that need the user first, then the latest change", () => {
    const [group] = groupByCategory([
      item("idle", "idle", 50),
      item("old", "working", 10),
      item("new", "working", 20),
      item("ask", "waiting", 0),
    ]);
    expect(group.items.map((entry) => entry.session.id)).toEqual(["ask", "new", "old", "idle"]);
  });
});

describe("countStates", () => {
  it("counts every state", () => {
    const counts = countStates([item("a", "working", 0), item("b", "working", 0)]);
    expect(counts.working).toBe(2);
    expect(counts.idle).toBe(0);
  });
});

describe("formatStateDuration", () => {
  it.each([
    [0, "0s"],
    [59_000, "59s"],
    [61_000, "1m"],
    [2 * 3_600_000, "2h"],
    [80 * 60_000, "1h 20m"],
    [50 * 3_600_000, "2d"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatStateDuration(ms)).toBe(expected);
  });
});

describe("engineLabel", () => {
  const manifests = [{ id: "anthropic-claude", name: "Claude Code" }];
  const global = { provider: "openai" as const, model: "gpt-5" };

  it("names the CLI of a terminal or CLI session", () => {
    expect(
      engineLabel({ kind: "terminal", cliProviderId: "anthropic-claude" }, manifests, global),
    ).toBe("Claude Code");
    expect(
      engineLabel(
        { kind: "agent", agentEngine: { kind: "cli", cliProviderId: "anthropic-claude" } },
        manifests,
        global,
      ),
    ).toBe("Claude Code");
  });

  it("prefers the pinned built-in model over the global one", () => {
    expect(
      engineLabel(
        { kind: "agent", agentEngine: { kind: "builtin", provider: "anthropic", model: "opus" } },
        manifests,
        global,
      ),
    ).toBe("Anthropic · opus");
    expect(engineLabel({ kind: "agent" }, manifests, global)).toBe("OpenAI · gpt-5");
  });
});
