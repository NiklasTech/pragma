import { describe, expect, it } from "vite-plus/test";

import type { AgentStatus } from "@/features/agent/store";

import { buildCloseConfirm, isSessionTabLive, type SessionCloseTarget } from "./sessionClose";

function target(overrides: Partial<SessionCloseTarget> = {}): SessionCloseTarget {
  return {
    sessionId: "s1",
    title: "Thread",
    kind: "agent",
    terminalStatus: null,
    ...overrides,
  };
}

function live(targets: SessionCloseTarget[], status: AgentStatus = "running"): boolean[] {
  return targets.map((item) => isSessionTabLive(item, status, "s1"));
}

describe("isSessionTabLive", () => {
  it("treats an empty tab as not live", () => {
    expect(isSessionTabLive(target({ sessionId: null }), "running", "s1")).toBe(false);
    expect(
      isSessionTabLive(
        target({ sessionId: null, kind: "terminal", terminalStatus: "running" }),
        "running",
        "s1",
      ),
    ).toBe(false);
  });

  it("is live only for a running terminal", () => {
    expect(live([target({ kind: "terminal", terminalStatus: "running" })])[0]).toBe(true);
    expect(live([target({ kind: "terminal", terminalStatus: "exited" })])[0]).toBe(false);
    expect(live([target({ kind: "terminal", terminalStatus: "cancelled" })])[0]).toBe(false);
    expect(live([target({ kind: "terminal", terminalStatus: null })])[0]).toBe(false);
  });

  it("is live for a running or waiting-approval conversation", () => {
    expect(live([target({ kind: "agent" })], "running")[0]).toBe(true);
    expect(live([target({ kind: "agent" })], "waiting-approval")[0]).toBe(true);
    expect(live([target({ kind: "ask" })], "running")[0]).toBe(true);
  });

  it("is not live for idle, done, error or cancelled conversations", () => {
    expect(live([target()], "idle")[0]).toBe(false);
    expect(live([target()], "done")[0]).toBe(false);
    expect(live([target()], "error")[0]).toBe(false);
    expect(live([target()], "cancelled")[0]).toBe(false);
  });

  it("is not live when another session owns the run", () => {
    expect(isSessionTabLive(target({ sessionId: "s2" }), "running", "s1")).toBe(false);
    expect(isSessionTabLive(target({ sessionId: "s2" }), "running", null)).toBe(false);
  });
});

describe("buildCloseConfirm", () => {
  it("returns null when nothing in the close set is live", () => {
    expect(buildCloseConfirm([], "running", "s1")).toBeNull();
    expect(
      buildCloseConfirm(
        [target(), target({ kind: "terminal", terminalStatus: "exited" })],
        "idle",
        "s1",
      ),
    ).toBeNull();
  });

  it("describes a single live terminal", () => {
    expect(
      buildCloseConfirm(
        [target({ kind: "terminal", terminalStatus: "running", title: "zsh" })],
        "idle",
        null,
      ),
    ).toEqual({
      title: "Close running terminal?",
      body: "zsh is still running. Closing the tab leaves the process running. The session can be opened again from the list.",
    });
  });

  it("describes a single live conversation", () => {
    expect(buildCloseConfirm([target({ title: "Fix bug" })], "running", "s1")).toEqual({
      title: "Close running session?",
      body: "Fix bug is still working. Closing the tab stops this turn.",
    });
    expect(buildCloseConfirm([target({ title: "Fix bug" })], "waiting-approval", "s1")).toEqual({
      title: "Close running session?",
      body: "Fix bug is still working. Closing the tab stops this turn.",
    });
  });

  it("describes more than one live tab", () => {
    expect(
      buildCloseConfirm(
        [
          target({ kind: "terminal", terminalStatus: "running" }),
          target({ sessionId: "s1", title: "Other" }),
        ],
        "running",
        "s1",
      ),
    ).toEqual({
      title: "Close running sessions?",
      body: "2 tabs still have a running session. A terminal keeps running. A conversation turn stops.",
    });
  });

  it("ignores non-live tabs when counting", () => {
    expect(
      buildCloseConfirm(
        [
          target({ sessionId: "s1", title: "Live" }),
          target({ sessionId: "s2", title: "Dead" }),
          target({ sessionId: null, title: "Empty" }),
        ],
        "running",
        "s1",
      ),
    ).toEqual({
      title: "Close running session?",
      body: "Live is still working. Closing the tab stops this turn.",
    });
  });
});
