import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  saveEnvironment: vi.fn(async (_rootPath: string, _environment: WorkEnvironment) => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ saveEnvironment: mocks.saveEnvironment }) },
}));

import { createWorktreeEnvironment } from "./create";

describe("createWorktreeEnvironment", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.saveEnvironment.mockClear();
  });

  it("branches from the checkout's HEAD by default", async () => {
    mocks.invoke.mockResolvedValue({
      branch: "pragma/aaaaaaaa",
      base_branch: "main",
      path: "/data/worktrees/x",
      setup_log: "",
      status: "ready",
    });

    const environment = await createWorktreeEnvironment("/repo");

    expect(mocks.invoke).toHaveBeenCalledWith("git_session_worktree_create", {
      repoPath: "/repo",
      environmentId: environment.id,
      baseBranch: null,
      label: null,
    });
    expect(environment.baseBranch).toBe("main");
  });

  it("passes a base branch and stores it on the environment", async () => {
    mocks.invoke.mockResolvedValue({
      branch: "pragma/bbbbbbbb",
      base_branch: "pragma/aaaaaaaa",
      path: "/data/worktrees/y",
      setup_log: "",
      status: "ready",
    });

    const environment = await createWorktreeEnvironment("/repo", "pragma/aaaaaaaa");

    expect(mocks.invoke).toHaveBeenCalledWith(
      "git_session_worktree_create",
      expect.objectContaining({ baseBranch: "pragma/aaaaaaaa" }),
    );
    expect(environment.baseBranch).toBe("pragma/aaaaaaaa");
    expect(mocks.saveEnvironment).toHaveBeenCalledWith("/repo", environment);
  });

  it("passes a task label for the branch name", async () => {
    mocks.invoke.mockResolvedValue({
      branch: "pragma/fix-login-cccccccc",
      base_branch: "main",
      path: "/data/worktrees/z",
      setup_log: "",
      status: "ready",
    });

    const environment = await createWorktreeEnvironment("/repo", undefined, "Fix login");

    expect(mocks.invoke).toHaveBeenCalledWith(
      "git_session_worktree_create",
      expect.objectContaining({ baseBranch: null, label: "Fix login" }),
    );
    expect(environment.branch).toBe("pragma/fix-login-cccccccc");
  });
});
