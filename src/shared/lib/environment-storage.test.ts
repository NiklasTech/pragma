import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { fromStoredEnvironment, saveEnvironment } from "./environment-storage";

describe("work environment storage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("saves environments in snake case", async () => {
    await saveEnvironment("/repo", {
      id: "env-1",
      rootPath: "/repo",
      kind: "worktree",
      path: "/data/worktrees/env-1",
      branch: "pragma/env1",
      baseBranch: "main",
      setupStatus: "error",
      setupLog: "failed",
    });

    expect(invokeMock).toHaveBeenCalledWith("ai_save_environment", {
      req: {
        root_path: "/repo",
        environment: {
          id: "env-1",
          kind: "worktree",
          path: "/data/worktrees/env-1",
          branch: "pragma/env1",
          base_branch: "main",
          setup_status: "error",
          setup_log: "failed",
        },
      },
    });
  });

  it("keeps the pull request of an environment", () => {
    const pullRequest = {
      number: 7,
      url: "https://github.com/o/r/pull/7",
      state: "OPEN" as const,
    };
    expect(
      fromStoredEnvironment(
        {
          id: "env-1",
          kind: "worktree",
          path: "/wt",
          branch: "pragma/env1",
          setup_status: "ready",
          setup_log: "",
          pull_request: pullRequest,
        },
        "/repo",
      ).pullRequest,
    ).toEqual(pullRequest);
  });

  it("restores environments without a base branch", () => {
    expect(
      fromStoredEnvironment(
        {
          id: "env-1",
          kind: "worktree",
          path: "/wt",
          branch: "pragma/env1",
          setup_status: "ready",
          setup_log: "",
        },
        "/repo",
      ),
    ).toEqual({
      id: "env-1",
      rootPath: "/repo",
      kind: "worktree",
      path: "/wt",
      branch: "pragma/env1",
      setupStatus: "ready",
      setupLog: "",
    });
  });
});
