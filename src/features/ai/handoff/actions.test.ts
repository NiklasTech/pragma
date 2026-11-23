import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  cancelTerminal: vi.fn(),
  ensureTerminal: vi.fn(),
  cliSessionId: "1ec907fa-5571" as string | null,
  createTerminalSession: vi.fn(),
  assignSession: vi.fn(),
  sendToAgent: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      cliManifests: [{ id: "anthropic-claude", name: "Claude Code", command: "claude" }],
      workEnvironments: [],
    }),
  },
}));
vi.mock("../terminal/runner", () => ({
  cancelTerminal: mocks.cancelTerminal,
  ensureTerminal: mocks.ensureTerminal,
  getTerminalCliSessionId: () => mocks.cliSessionId,
  getTerminalSize: () => ({ cols: 100, rows: 30 }),
}));
vi.mock("../terminal/cliAttention", () => ({
  terminalLaunchCommand: (_id: string, command: string) => `${command} --settings '{}'`,
}));
vi.mock("../panes/launch", () => ({ createTerminalSession: mocks.createTerminalSession }));
vi.mock("../panes/store", () => ({
  useAgentsPanesStore: { getState: () => ({ assignSession: mocks.assignSession }) },
}));
vi.mock("../ci/send", () => ({ sendToAgent: mocks.sendToAgent }));

import { cancelWait, CONTINUE_PROMPT, continueWithAccount, waitForReset } from "./actions";
import { useAgentStatesStore } from "../state/agentStates";
import { useHandoffStore } from "./store";

const session: ChatSession = {
  id: "s1",
  rootPath: "/repo",
  title: "Billing export",
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  kind: "terminal",
  cliProviderId: "anthropic-claude",
};

describe("continueWithAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStatesStore.setState({
      entries: { s1: { state: "needs-you", seen: false, changedAt: 1 } },
    });
    mocks.cliSessionId = "1ec907fa-5571";
    mocks.invoke.mockResolvedValue(undefined);
    mocks.createTerminalSession.mockResolvedValue({ ...session, id: "s2" });
  });

  it("shares the session, ends the old CLI and resumes it with the other account in the pane", async () => {
    await continueWithAccount("/repo", "leaf-1", session, "/h/.claude-work");

    expect(mocks.invoke).toHaveBeenCalledWith("claude_session_share", {
      sessionId: "1ec907fa-5571",
      fromDir: null,
      toDir: "/h/.claude-work",
    });
    expect(mocks.cancelTerminal).toHaveBeenCalledWith("s1");
    expect(mocks.createTerminalSession).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({ id: "anthropic-claude" }),
      expect.objectContaining({ accountDir: "/h/.claude-work", title: "Billing export" }),
    );
    expect(mocks.ensureTerminal).toHaveBeenCalledWith("s2", {
      command: `claude --settings '{}' --resume 1ec907fa-5571 "${CONTINUE_PROMPT}"`,
      cwd: "/repo",
      account: { providerId: "anthropic-claude", configDir: "/h/.claude-work" },
      cols: 100,
      rows: 30,
    });
    expect(mocks.assignSession).toHaveBeenCalledWith("/repo", "leaf-1", "s2");
    expect(useAgentStatesStore.getState().entries.s1?.state ?? "idle").toBe("idle");
  });

  it("stops before touching anything when the session id is unknown", async () => {
    mocks.cliSessionId = null;
    await expect(continueWithAccount("/repo", "leaf-1", session, null)).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.cancelTerminal).not.toHaveBeenCalled();
  });
});

describe("waitForReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useHandoffStore.setState({ limitHit: {}, dismissed: {}, waitingUntil: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends continue a minute after the reset", () => {
    waitForReset(session, 1_000_000 + 10 * 60_000);
    expect(useHandoffStore.getState().waitingUntil.s1).toBe(1_000_000 + 11 * 60_000);
    vi.advanceTimersByTime(11 * 60_000 - 1);
    expect(mocks.sendToAgent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mocks.sendToAgent).toHaveBeenCalledWith(session, CONTINUE_PROMPT);
    expect(useHandoffStore.getState().waitingUntil.s1).toBeUndefined();
  });

  it("can be cancelled", () => {
    waitForReset(session, 1_000_000 + 60_000);
    cancelWait("s1");
    vi.advanceTimersByTime(10 * 60_000);
    expect(mocks.sendToAgent).not.toHaveBeenCalled();
    expect(useHandoffStore.getState().waitingUntil.s1).toBeUndefined();
  });
});
