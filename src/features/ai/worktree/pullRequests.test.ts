import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  saveEnvironment: vi.fn(),
  releaseWorktree: vi.fn(),
  ghReady: true,
  removeWorktrees: true,
  sessions: [] as ChatSession[],
  environments: [] as WorkEnvironment[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: mocks.sessions,
      workEnvironments: mocks.environments,
      saveEnvironment: mocks.saveEnvironment,
    }),
  },
}));
vi.mock("./cleanup", () => ({
  autoRemoveWorktrees: () => mocks.removeWorktrees,
  releaseWorktree: mocks.releaseWorktree,
}));
vi.mock("./finish", () => ({ isGhReady: async () => mocks.ghReady }));

import { checkSessionPullRequests, pullRequestFromUrl, rememberPullRequest } from "./pullRequests";

const PR_URL = "https://github.com/o/r/pull/42";

function worktree(id: string, state: "OPEN" | "CLOSED" | "MERGED"): WorkEnvironment {
  return {
    id,
    kind: "worktree",
    path: `/data/worktrees/${id}`,
    branch: "pragma/1a2b3c4d",
    setupStatus: "ready",
    setupLog: "",
    pullRequest: { number: 42, url: PR_URL, state },
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

function ghReturns(state: "OPEN" | "CLOSED" | "MERGED" | null) {
  mocks.invoke.mockResolvedValue(state ? { number: 42, state } : null);
}

describe("pullRequestFromUrl", () => {
  it("reads the number from the URL gh prints", () => {
    expect(pullRequestFromUrl(` ${PR_URL}\n`)).toEqual({ number: 42, url: PR_URL, state: "OPEN" });
    expect(pullRequestFromUrl("")).toBeNull();
    expect(pullRequestFromUrl("https://github.com/o/r/pull/0")).toBeNull();
  });
});

describe("rememberPullRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.environments = [{ ...worktree("env-1", "OPEN"), pullRequest: undefined }];
  });

  it("stores the open pull request on the environment", async () => {
    await rememberPullRequest("/repo", "env-1", PR_URL);

    expect(mocks.saveEnvironment).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({
        id: "env-1",
        pullRequest: { number: 42, url: PR_URL, state: "OPEN" },
      }),
    );
  });
});

describe("checkSessionPullRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ghReady = true;
    mocks.removeWorktrees = true;
    mocks.environments = [worktree("env-1", "OPEN")];
    mocks.sessions = [session("a", "env-1")];
    mocks.releaseWorktree.mockResolvedValue("removed");
  });

  it("cleans up the worktree and branch of a squash-merged pull request", async () => {
    ghReturns("MERGED");

    await checkSessionPullRequests("/repo");

    expect(mocks.invoke).toHaveBeenCalledWith("gh_pr_current", { repoPath: "/repo", number: 42 });
    expect(mocks.saveEnvironment).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({ pullRequest: { number: 42, url: PR_URL, state: "MERGED" } }),
    );
    expect(mocks.releaseWorktree).toHaveBeenCalledWith(
      "/repo",
      "env-1",
      new Set(["a"]),
      false,
      true,
    );
  });

  it("keeps the worktree of a closed, unmerged pull request and marks it closed", async () => {
    ghReturns("CLOSED");

    await checkSessionPullRequests("/repo");

    expect(mocks.saveEnvironment).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({ pullRequest: { number: 42, url: PR_URL, state: "CLOSED" } }),
    );
    expect(mocks.releaseWorktree).not.toHaveBeenCalled();
  });

  it("leaves an open pull request alone", async () => {
    ghReturns("OPEN");

    await checkSessionPullRequests("/repo");

    expect(mocks.saveEnvironment).not.toHaveBeenCalled();
    expect(mocks.releaseWorktree).not.toHaveBeenCalled();
  });

  it("does nothing when gh fails or finds no pull request", async () => {
    mocks.invoke.mockRejectedValue(new Error("offline"));
    await checkSessionPullRequests("/repo");
    ghReturns(null);
    await checkSessionPullRequests("/repo");

    expect(mocks.saveEnvironment).not.toHaveBeenCalled();
    expect(mocks.releaseWorktree).not.toHaveBeenCalled();
  });

  it("does nothing without an installed and authenticated gh", async () => {
    mocks.ghReady = false;
    ghReturns("MERGED");

    await checkSessionPullRequests("/repo");

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.releaseWorktree).not.toHaveBeenCalled();
  });

  it("does not check closed pull requests again", async () => {
    mocks.environments = [worktree("env-1", "CLOSED")];

    await checkSessionPullRequests("/repo");

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("retries the cleanup of a merged pull request whose worktree is still in use", async () => {
    mocks.environments = [worktree("env-2", "MERGED")];
    mocks.sessions = [session("b", "env-2")];
    mocks.releaseWorktree.mockResolvedValue("in-use");

    await checkSessionPullRequests("/repo");
    await checkSessionPullRequests("/repo");

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.releaseWorktree).toHaveBeenCalledTimes(2);
  });

  it("tries a dirty worktree only once per app run", async () => {
    mocks.environments = [worktree("env-3", "MERGED")];
    mocks.releaseWorktree.mockResolvedValue("dirty");

    await checkSessionPullRequests("/repo");
    await checkSessionPullRequests("/repo");

    expect(mocks.releaseWorktree).toHaveBeenCalledTimes(1);
  });

  it("keeps a merged worktree when automatic removal is off", async () => {
    mocks.removeWorktrees = false;
    ghReturns("MERGED");

    await checkSessionPullRequests("/repo");

    expect(mocks.saveEnvironment).toHaveBeenCalled();
    expect(mocks.releaseWorktree).not.toHaveBeenCalled();
  });
});
