import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const calls = vi.hoisted(() => ({ list: [] as Array<{ command: string; repoPath: string }> }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args: { repoPath: string }) => {
    calls.list.push({ command, repoPath: args.repoPath });
    if (command === "git_status") {
      return {
        snapshot: {
          repo: { repo_root: args.repoPath, branch: "main", upstream: null, is_detached: false },
          changed_files: [],
          ahead: 0,
          behind: 0,
        },
      };
    }
    return {};
  },
}));

import { useRepositoryGitStore } from "./repositoryGit";

describe("useRepositoryGitStore", () => {
  beforeEach(() => {
    calls.list = [];
    useRepositoryGitStore.setState({ byRoot: {} });
  });

  it("loads the status of each repository for its own path", async () => {
    await useRepositoryGitStore.getState().loadStatus("/code/a");
    await useRepositoryGitStore.getState().loadStatus("/code/b");

    const { byRoot } = useRepositoryGitStore.getState();
    expect(byRoot["/code/a"]?.snapshot?.repo.repo_root).toBe("/code/a");
    expect(byRoot["/code/b"]?.snapshot?.repo.repo_root).toBe("/code/b");
  });

  it("stages and commits in the repository it is asked for, then reloads its status", async () => {
    const store = useRepositoryGitStore.getState();
    await store.stage("/code/b", ["src/main.ts"]);
    const committed = await store.commit("/code/b", "  Fix the bug  ");

    expect(committed).toBe(true);
    expect(calls.list).toEqual([
      { command: "git_stage", repoPath: "/code/b" },
      { command: "git_status", repoPath: "/code/b" },
      { command: "git_commit", repoPath: "/code/b" },
      { command: "git_status", repoPath: "/code/b" },
    ]);
  });

  it("does not commit without a message", async () => {
    expect(await useRepositoryGitStore.getState().commit("/code/b", "   ")).toBe(false);
    expect(calls.list).toEqual([]);
  });

  it("drops the status of a repository that is unloaded while it loads", async () => {
    const loading = useRepositoryGitStore.getState().loadStatus("/code/a");
    useRepositoryGitStore.getState().unload("/code/a");
    await loading;

    expect(useRepositoryGitStore.getState().byRoot["/code/a"]).toBeUndefined();
  });
});
