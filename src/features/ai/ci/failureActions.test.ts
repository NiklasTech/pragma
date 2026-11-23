import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  sendToAgent: vi.fn(),
  agent: null as ChatSession | null,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./send", () => ({
  environmentAgentSession: () => mocks.agent,
  sendToAgent: mocks.sendToAgent,
}));

import { useAgentStatesStore } from "../state/agentStates";
import { askAboutFailure } from "./attention";
import { ignoreFailure, sendFailureToAgent } from "./failureActions";
import { ciStatus } from "./status";
import { useAgentCiStore } from "./store";

const LINK = "https://github.com/o/r/actions/runs/1/job/2";

const agent: ChatSession = {
  id: "s1",
  rootPath: "/repo",
  title: "Claude Code",
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  kind: "terminal",
  environmentId: "env-1",
};

function failing(link = LINK) {
  return ciStatus([
    { name: "test", workflow: "CI", bucket: "fail", link },
    { name: "lint", workflow: "CI", bucket: "pass", link: "" },
  ]);
}

describe("CI failure actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agent = agent;
    mocks.invoke.mockResolvedValue("error: boom");
    mocks.sendToAgent.mockResolvedValue(undefined);
    useAgentStatesStore.setState({ entries: {} });
    useAgentCiStore.setState({
      byEnvironment: {
        "env-1": { number: 42, url: "https://github.com/o/r/pull/42", status: failing() },
      },
      handled: {},
      asking: {},
      fixes: {},
      history: {},
    });
  });

  it("sends the failure with its log to the agent and puts the card away", async () => {
    expect(await sendFailureToAgent("/repo", "env-1")).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("gh_check_failure_log", {
      repoPath: "/repo",
      link: LINK,
    });
    const [session, message] = mocks.sendToAgent.mock.calls[0];
    expect(session).toBe(agent);
    expect(message).toContain("CI failed on pull request #42");
    expect(message).toContain("1 of 2 checks failed: CI / test.");
    expect(message).toContain("error: boom");
    expect(useAgentCiStore.getState().handled["env-1"]).toBe(LINK);
  });

  it("sends nothing without a running agent", async () => {
    mocks.agent = null;
    expect(await sendFailureToAgent("/repo", "env-1")).toBe(false);
    expect(mocks.sendToAgent).not.toHaveBeenCalled();
    expect(useAgentCiStore.getState().handled).toEqual({});
  });

  it("asking marks the agent as needing you, and ignoring clears it", () => {
    askAboutFailure("/repo", "env-1", LINK);
    expect(useAgentStatesStore.getState().entries.s1?.state).toBe("needs-you");
    expect(useAgentCiStore.getState().asking["env-1"]).toBe(LINK);

    ignoreFailure("/repo", "env-1");
    expect(useAgentStatesStore.getState().entries.s1?.state).toBe("idle");
    expect(useAgentCiStore.getState().handled["env-1"]).toBe(LINK);
  });

  it("records the send in the history", async () => {
    await sendFailureToAgent("/repo", "env-1", "try 2");
    expect(useAgentCiStore.getState().history["env-1"]?.map((event) => event.text)).toEqual([
      "sent to Claude Code, try 2",
    ]);
  });
});
