import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  updateChatSession: vi.fn(async () => {}),
  deleteEnvironment: vi.fn(async (_root: string, _id: string) => {}),
  sessions: [] as ChatSession[],
  environments: [] as WorkEnvironment[],
  removeWorktrees: true,
  runSessionId: null as string | null,
  results: {} as Record<string, unknown>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: { warning: mocks.toastWarning, error: mocks.toastError } }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: mocks.sessions,
      workEnvironments: mocks.environments,
      updateChatSession: mocks.updateChatSession,
      deleteEnvironment: mocks.deleteEnvironment,
    }),
  },
}));
vi.mock("@/features/agent/store", () => ({
  useAgentStore: {
    getState: () => ({ runSessionId: mocks.runSessionId, requestStop: vi.fn() }),
  },
}));
vi.mock("@/shared/stores/git", () => ({
  useGitStore: { getState: () => ({ repoPath: null, loadBranches: vi.fn() }) },
}));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: {
    getState: () => ({ agent: { removeWorktrees: mocks.removeWorktrees } }),
  },
}));
vi.mock("../children/runStore", () => ({
  getChildRun: () => undefined,
  isRunLive: () => false,
}));
vi.mock("../terminal/runner", () => ({ getTerminalEntryStatus: () => null }));

import { isPragmaBranch, releaseWorktree, releaseWorktrees, worktreeKeepReason } from "./cleanup";

const WORKTREE: WorkEnvironment = {
  id: "env-1",
  rootPath: "/repo",
  kind: "worktree",
  path: "/data/worktrees/env-1",
  branch: "pragma/1a2b3c4d",
  setupStatus: "ready",
  setupLog: "",
};

function session(id: string, init: Partial<ChatSession> = {}): ChatSession {
  return { id, rootPath: "/repo", title: id, messages: [], createdAt: 0, updatedAt: 0, ...init };
}

function commands(): string[] {
  return mocks.invoke.mock.calls.map(([command]) => String(command));
}

const notRunning = () => false;

describe("isPragmaBranch", () => {
  it("accepts only pragma session branches", () => {
    expect(isPragmaBranch("pragma/1a2b3c4d")).toBe(true);
    expect(isPragmaBranch("pragma/1a2b3c4d-2")).toBe(true);
    expect(isPragmaBranch("main")).toBe(false);
    expect(isPragmaBranch("pragma/feature")).toBe(false);
    expect(isPragmaBranch("feat/pragma/1a2b3c4d")).toBe(false);
  });

  it("matches the Rust rule for branches named after a task", () => {
    for (const branch of ["pragma/fix-login-1a2b3c4d", "pragma/fix-2-login-1a2b3c4d-3"]) {
      expect(isPragmaBranch(branch)).toBe(true);
    }
    for (const branch of [
      "pragma/fix-login",
      "pragma/Fix-1a2b3c4d",
      "pragma/fix--1a2b3c4d",
      "pragma/-1a2b3c4d",
      "pragma/1a2b3c4d-",
      "feat/1a2b3c4d",
    ]) {
      expect(isPragmaBranch(branch)).toBe(false);
    }
  });
});

describe("worktreeKeepReason", () => {
  const finished = new Set(["a"]);

  it("skips checkouts and branches Pragma did not create", () => {
    const checkout: WorkEnvironment = { ...WORKTREE, kind: "checkout", branch: "" };
    expect(worktreeKeepReason(checkout, [], finished, notRunning)).toBe("skipped");
    expect(worktreeKeepReason({ ...WORKTREE, branch: "main" }, [], finished, notRunning)).toBe(
      "skipped",
    );
    expect(worktreeKeepReason(undefined, [], finished, notRunning)).toBe("skipped");
  });

  it("keeps a shared worktree while another session references it", () => {
    const sessions = [
      session("a", { environmentId: "env-1" }),
      session("b", { environmentId: "env-1" }),
    ];
    expect(worktreeKeepReason(WORKTREE, sessions, finished, notRunning)).toBe("in-use");
  });

  it("keeps a worktree while a finished session still runs in it", () => {
    const sessions = [session("a", { environmentId: "env-1" })];
    expect(worktreeKeepReason(WORKTREE, sessions, finished, (id) => id === "a")).toBe("in-use");
  });

  it("releases a worktree only finished or archived sessions reference", () => {
    const sessions = [
      session("a", { environmentId: "env-1" }),
      session("b", { environmentId: "env-1", archived: true }),
      session("c", { environmentId: "env-2" }),
    ];
    expect(worktreeKeepReason(WORKTREE, sessions, finished, notRunning)).toBeNull();
  });
});

describe("releaseWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions = [session("a", { environmentId: "env-1" })];
    mocks.environments = [WORKTREE];
    mocks.removeWorktrees = true;
    mocks.runSessionId = null;
    mocks.results = {
      git_session_worktree_dirty: false,
      git_session_worktree_teardown: { ok: true, log: "" },
      git_session_branch_merged: true,
    };
    mocks.invoke.mockImplementation(async (command: string) => mocks.results[command] ?? null);
  });

  it("removes a clean worktree and deletes its merged branch", async () => {
    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("removed");

    expect(mocks.invoke).toHaveBeenCalledWith("git_session_worktree_remove", {
      repoPath: "/repo",
      worktreePath: WORKTREE.path,
      force: false,
    });
    expect(mocks.invoke).toHaveBeenCalledWith("git_session_delete_branch", {
      repoPath: "/repo",
      branch: WORKTREE.branch,
    });
    expect(mocks.updateChatSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", environment: "checkout", environmentId: undefined }),
    );
    expect(mocks.deleteEnvironment).toHaveBeenCalledWith("/repo", "env-1");
  });

  it("keeps the branch when it is not merged", async () => {
    mocks.results.git_session_branch_merged = false;

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("removed");

    expect(commands()).toContain("git_session_worktree_remove");
    expect(commands()).not.toContain("git_session_delete_branch");
  });

  it("deletes a squash-merged branch git does not see as merged", async () => {
    mocks.results.git_session_branch_merged = false;

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]), false, true)).resolves.toBe(
      "removed",
    );

    expect(commands()).not.toContain("git_session_branch_merged");
    expect(mocks.invoke).toHaveBeenCalledWith("git_session_delete_branch", {
      repoPath: "/repo",
      branch: WORKTREE.branch,
    });
  });

  it("never removes a worktree with uncommitted changes, but offers to discard it", async () => {
    mocks.results.git_session_worktree_dirty = true;

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("dirty");

    expect(commands()).toEqual(["git_session_worktree_dirty"]);
    expect(mocks.deleteEnvironment).not.toHaveBeenCalled();
    const options = mocks.toastWarning.mock.calls[0]?.[1] as {
      action: { label: string; onClick: () => void };
    };
    expect(options.action.label).toBe("Discard");

    options.action.onClick();
    await vi.waitFor(() => expect(mocks.deleteEnvironment).toHaveBeenCalledWith("/repo", "env-1"));
    expect(mocks.invoke).toHaveBeenCalledWith("git_session_worktree_remove", {
      repoPath: "/repo",
      worktreePath: WORKTREE.path,
      force: true,
    });
  });

  it("keeps the worktree and shows the log when the teardown hook fails", async () => {
    mocks.results.git_session_worktree_teardown = { ok: false, log: "teardown failed" };

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("failed");

    expect(commands()).not.toContain("git_session_worktree_remove");
    expect(commands()).not.toContain("git_session_delete_branch");
    expect(mocks.toastError).toHaveBeenCalledWith("teardown failed");
    expect(mocks.deleteEnvironment).not.toHaveBeenCalled();
  });

  it("does not touch a worktree another session still uses", async () => {
    mocks.sessions = [
      session("a", { environmentId: "env-1" }),
      session("b", { environmentId: "env-1" }),
    ];

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("in-use");

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("does not touch a worktree on a branch Pragma did not create", async () => {
    mocks.environments = [{ ...WORKTREE, branch: "feat/mine" }];

    await expect(releaseWorktree("/repo", "env-1", new Set(["a"]))).resolves.toBe("skipped");

    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe("releaseWorktrees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions = [];
    mocks.environments = [WORKTREE];
    mocks.invoke.mockResolvedValue(false);
  });

  it("does nothing when the setting is off", async () => {
    mocks.removeWorktrees = false;

    await releaseWorktrees("/repo", [session("a", { environmentId: "env-1" })]);

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("releases the worktree of a deleted session", async () => {
    mocks.removeWorktrees = true;

    await releaseWorktrees("/repo", [session("a", { environmentId: "env-1" })]);

    expect(commands()).toContain("git_session_worktree_dirty");
  });
});

describe("closing sessions in any order", () => {
  const SHARED: WorkEnvironment = { ...WORKTREE, branch: "pragma/fix-login-1a2b3c4d" };
  const OWN: WorkEnvironment = {
    ...WORKTREE,
    id: "env-2",
    path: "/data/worktrees/env-2",
    branch: "pragma/add-tests-5e6f7a8b",
  };

  function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [[...items]];
    return items.flatMap((item, index) =>
      permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
        item,
        ...rest,
      ]),
    );
  }

  beforeEach(() => {
    mocks.removeWorktrees = true;
    mocks.runSessionId = null;
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "git_session_worktree_teardown") return { ok: true, log: "" };
      return false;
    });
    mocks.deleteEnvironment.mockImplementation(async (_root: string, id: string) => {
      mocks.environments = mocks.environments.filter((environment) => environment.id !== id);
    });
  });

  it("leaves no worktree behind and removes each one once", async () => {
    const all = [
      session("a", { environmentId: "env-1" }),
      session("b", { environmentId: "env-1" }),
      session("c", { environmentId: "env-2" }),
    ];
    for (const order of permutations(all)) {
      mocks.invoke.mockClear();
      mocks.sessions = [...all];
      mocks.environments = [SHARED, OWN];
      for (const closed of order) {
        mocks.sessions = mocks.sessions.filter((item) => item.id !== closed.id);
        await releaseWorktrees("/repo", [closed]);
      }
      const removed = mocks.invoke.mock.calls
        .filter(([command]) => command === "git_session_worktree_remove")
        .map(([, args]) => (args as { worktreePath: string }).worktreePath);
      expect(mocks.environments).toEqual([]);
      expect(removed.sort()).toEqual([OWN.path, SHARED.path].sort());
    }
  });
});
