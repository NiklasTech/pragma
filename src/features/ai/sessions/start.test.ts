import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession, CreateChatSessionInit, WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
  createWorktreeEnvironment: vi.fn(),
  discardWorktreeEnvironment: vi.fn(async () => {}),
  createChatSession: vi.fn(async (rootPath: string, init?: CreateChatSessionInit) => ({
    id: "new",
    rootPath,
    title: "New Chat",
    messages: [],
    createdAt: 1,
    updatedAt: 1,
    ...init,
  })),
  writingSessions: undefined as "worktree" | "checkout" | undefined,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({ chatSessions: [], createChatSession: mocks.createChatSession }),
  },
  repositorySessions: () => [],
}));
vi.mock("@/shared/stores/workspaceSettings/repositories", () => ({
  repositoryWorkspaceSettings: (rootPath: string) =>
    rootPath === "/repo" ? { agent: { writingSessions: mocks.writingSessions } } : null,
}));
vi.mock("../worktree/create", () => ({
  createWorktreeEnvironment: mocks.createWorktreeEnvironment,
}));
vi.mock("../worktree/remove", () => ({
  discardWorktreeEnvironment: mocks.discardWorktreeEnvironment,
}));

import { startSession } from "./start";

function worktree(setupStatus: WorkEnvironment["setupStatus"]): WorkEnvironment {
  return {
    id: "env-1",
    rootPath: "/repo",
    kind: "worktree",
    path: "/data/worktrees/env-1",
    branch: "pragma/env-1",
    setupStatus,
    setupLog: setupStatus === "error" ? "install\nnpm ERR! missing" : "",
  };
}

describe("startSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writingSessions = undefined;
    mocks.invoke.mockResolvedValue({ is_repo: true, reason: null });
    mocks.createWorktreeEnvironment.mockResolvedValue(worktree("ready"));
  });

  it.each(["agent", "terminal"] as const)(
    "creates a worktree for a %s session when the setting asks for one",
    async (kind) => {
      mocks.writingSessions = "worktree";

      const session = await startSession("/repo", { init: { kind } });

      expect(mocks.createWorktreeEnvironment).toHaveBeenCalledWith("/repo");
      expect(session).toMatchObject({ kind, environment: "worktree", environmentId: "env-1" });
    },
  );

  it("uses the checkout when the setting says so", async () => {
    mocks.writingSessions = "checkout";

    const session = await startSession("/repo", { init: { kind: "terminal" } });

    expect(mocks.createWorktreeEnvironment).not.toHaveBeenCalled();
    expect(session.environment).toBe("checkout");
  });

  it("never checks the repository for an ask session", async () => {
    mocks.writingSessions = "worktree";

    const session = await startSession("/repo", { init: { kind: "ask" } });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(session.environment).toBe("checkout");
  });

  it("uses the checkout outside a git repository", async () => {
    mocks.invoke.mockResolvedValue({ is_repo: false, reason: "not a repo" });

    const session = await startSession("/folder", {
      init: { kind: "agent" },
      environment: "worktree",
    });

    expect(session.environment).toBe("checkout");
  });

  it("keeps the source's environment for a copy", async () => {
    const source: Pick<ChatSession, "environment" | "environmentId"> = {
      environment: "worktree",
      environmentId: "env-source",
    };

    const session = await startSession("/repo", {
      init: { kind: "agent" },
      sameEnvironmentAs: source,
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(session).toMatchObject({ environment: "worktree", environmentId: "env-source" });
  });

  it("reports a failed setup hook and still starts the session", async () => {
    mocks.createWorktreeEnvironment.mockResolvedValue(worktree("error"));

    const session = await startSession("/repo", {
      init: { kind: "agent" },
      environment: "worktree",
    });

    expect(mocks.toastError).toHaveBeenCalledWith("The worktree setup script failed", {
      description: "npm ERR! missing",
    });
    expect(session.environmentId).toBe("env-1");
  });

  it("discards the worktree and fails when a ready worktree is required", async () => {
    mocks.createWorktreeEnvironment.mockResolvedValue(worktree("error"));

    await expect(
      startSession("/repo", {
        init: { kind: "agent" },
        environment: "worktree",
        requireWorktree: true,
      }),
    ).rejects.toThrow("The worktree setup script failed");
    expect(mocks.discardWorktreeEnvironment).toHaveBeenCalledWith("/repo", worktree("error"));
    expect(mocks.createChatSession).not.toHaveBeenCalled();
  });
});
