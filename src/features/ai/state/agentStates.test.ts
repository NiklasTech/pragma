import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  compareAgentStates,
  liveSessionIds,
  nextAgentState,
  summarizeAgentStates,
  useAgentStatesStore,
  type AgentStateEntry,
  type AgentStateEvent,
} from "./agentStates";

function run(events: AgentStateEvent[]): AgentStateEntry | undefined {
  return events.reduce<AgentStateEntry | undefined>(
    (entry, event, index) => nextAgentState(entry, event, index + 1),
    undefined,
  );
}

describe("nextAgentState", () => {
  it("moves through working, needs you and done", () => {
    expect(run(["working"])?.state).toBe("working");
    expect(run(["working", "needs-you"])?.state).toBe("needs-you");
    expect(run(["working", "needs-you", "working"])?.state).toBe("working");
    expect(run(["working", "done"])?.state).toBe("done");
  });

  it("keeps an unseen done when the session goes idle", () => {
    expect(run(["working", "done", "idle"])?.state).toBe("done");
    expect(run(["working", "done", "seen", "idle"])?.state).toBe("idle");
  });

  it("clears done once it is seen, but not a question", () => {
    expect(run(["working", "done", "seen"])?.state).toBe("idle");
    const asked = run(["needs-you", "seen"]);
    expect(asked?.state).toBe("needs-you");
    expect(asked?.seen).toBe(true);
  });

  it("goes idle from working and keeps the entry when nothing changes", () => {
    expect(run(["working", "idle"])?.state).toBe("idle");
    const working = run(["working"]);
    expect(nextAgentState(working, "working", 99)).toBe(working);
  });
});

describe("liveSessionIds", () => {
  it("leaves out archived sessions", () => {
    expect([...liveSessionIds([{ id: "a" }, { id: "b", archived: true }])]).toEqual(["a"]);
  });
});

describe("summarizeAgentStates", () => {
  it("orders by urgency and picks the oldest question first", () => {
    const entry = (state: AgentStateEntry["state"], changedAt: number): AgentStateEntry => ({
      state,
      seen: false,
      changedAt,
    });
    const summary = summarizeAgentStates({
      a: entry("working", 5),
      b: entry("needs-you", 9),
      c: entry("needs-you", 3),
      d: entry("done", 7),
    });
    expect(summary.needsYou).toEqual(["c", "b"]);
    expect(summary.first).toBe("c");
    expect(summary.done).toEqual(["d"]);
    expect(compareAgentStates("done", "working")).toBeLessThan(0);
  });
});

describe("useAgentStatesStore", () => {
  beforeEach(() => useAgentStatesStore.setState({ entries: {} }));

  it("does not store sessions that only ever were idle", () => {
    useAgentStatesStore.getState().apply("s", "idle");
    expect(useAgentStatesStore.getState().entries).toEqual({});
    useAgentStatesStore.getState().apply("s", "working");
    useAgentStatesStore.getState().forget("s");
    expect(useAgentStatesStore.getState().entries).toEqual({});
  });
});
