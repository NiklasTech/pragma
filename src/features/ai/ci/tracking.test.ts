import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  saveEnvironment: vi.fn(),
  ghReady: true,
  running: [] as ChatSession[],
  environments: [] as WorkEnvironment[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      workEnvironments: mocks.environments,
      saveEnvironment: mocks.saveEnvironment,
    }),
  },
}));
vi.mock("../sessions/runningSessions", () => ({
  runningRepositorySessions: () => mocks.running,
}));
vi.mock("../worktree/finish", () => ({ isGhReady: async () => mocks.ghReady }));

import { useAgentCiStore } from "./store";
import { checkAgentPullRequests } from "./tracking";

const PR_URL = "https://github.com/o/r/pull/42";

function worktree(id: string, pullRequest?: WorkEnvironment["pullRequest"]): WorkEnvironment {
  return {
    id,
    rootPath: "/repo",
    kind: "worktree",
    path: `/data/worktrees/${id}`,
    branch: `pragma/${id}`,
    setupStatus: "ready",
    setupLog: "",
    pullRequest,
  };
}

function session(id: string, environmentId: string): ChatSession {
  return {
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    environmentId,
  };
}

function ghAnswers(answers: {
  branch?: Record<string, unknown> | null;
  checks?: { name: string; bucket: string }[] | Error;
}) {
  mocks.invoke.mockImplementation(async (command: string) => {
    if (command === "gh_pr_current") return answers.branch ?? null;
    if (command === "gh_pr_checks") {
      if (answers.checks instanceof Error) throw answers.checks;
      return (answers.checks ?? []).map((check) => ({ workflow: "CI", link: "", ...check }));
    }
    throw new Error(`unexpected ${command}`);
  });
}

describe("checkAgentPullRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ghReady = true;
    mocks.saveEnvironment.mockResolvedValue(undefined);
    useAgentCiStore.setState({ byEnvironment: {} });
  });

  it("finds a pull request the agent opened and remembers it", async () => {
    mocks.environments = [worktree("env-1")];
    mocks.running = [session("s1", "env-1")];
    ghAnswers({
      branch: { number: 42, url: PR_URL, state: "OPEN" },
      checks: [{ name: "test", bucket: "pending" }],
    });

    expect(await checkAgentPullRequests("/repo")).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("gh_pr_current", {
      repoPath: "/data/worktrees/env-1",
    });
    expect(mocks.saveEnvironment).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({
        id: "env-1",
        pullRequest: { number: 42, url: PR_URL, state: "OPEN" },
      }),
    );
    expect(useAgentCiStore.getState().byEnvironment["env-1"]).toMatchObject({
      number: 42,
      status: { state: "pending" },
    });
  });

  it("checks a known pull request without looking it up again", async () => {
    mocks.environments = [worktree("env-1", { number: 42, url: PR_URL, state: "OPEN" })];
    mocks.running = [session("s1", "env-1")];
    ghAnswers({ checks: [{ name: "test", bucket: "fail" }] });

    expect(await checkAgentPullRequests("/repo")).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalledWith("gh_pr_current", expect.anything());
    expect(mocks.invoke).toHaveBeenCalledWith("gh_pr_checks", { repoPath: "/repo", number: 42 });
    expect(useAgentCiStore.getState().byEnvironment["env-1"]?.status?.state).toBe("failing");
  });

  it("skips worktrees without a running session and drops what it knew of them", async () => {
    mocks.environments = [worktree("env-1", { number: 42, url: PR_URL, state: "OPEN" })];
    mocks.running = [];
    useAgentCiStore.setState({
      byEnvironment: { "env-1": { number: 42, url: PR_URL, status: null } },
    });

    await checkAgentPullRequests("/repo");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(useAgentCiStore.getState().byEnvironment).toEqual({});
  });

  it("ignores merged pull requests and branches without one", async () => {
    mocks.environments = [
      worktree("env-1", { number: 7, url: PR_URL, state: "MERGED" }),
      worktree("env-2"),
    ];
    mocks.running = [session("s1", "env-1"), session("s2", "env-2")];
    ghAnswers({ branch: null });

    await checkAgentPullRequests("/repo");
    expect(mocks.invoke).not.toHaveBeenCalledWith("gh_pr_checks", expect.anything());
    expect(mocks.saveEnvironment).not.toHaveBeenCalled();
    expect(useAgentCiStore.getState().byEnvironment).toEqual({});
  });

  it("keeps the last known checks when gh fails", async () => {
    const known = {
      number: 42,
      url: PR_URL,
      status: { state: "pending" as const, failing: [], pending: 1, total: 1, failureKey: "" },
    };
    mocks.environments = [worktree("env-1", { number: 42, url: PR_URL, state: "OPEN" })];
    mocks.running = [session("s1", "env-1")];
    useAgentCiStore.setState({ byEnvironment: { "env-1": known } });
    ghAnswers({ checks: new Error("network") });

    await checkAgentPullRequests("/repo");
    expect(useAgentCiStore.getState().byEnvironment["env-1"]).toEqual(known);
  });

  it("does nothing without a signed-in gh", async () => {
    mocks.environments = [worktree("env-1")];
    mocks.running = [session("s1", "env-1")];
    mocks.ghReady = false;

    expect(await checkAgentPullRequests("/repo")).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
