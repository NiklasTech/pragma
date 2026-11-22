import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const status = vi.hoisted(() => ({ files: ["a.ts"] }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (command: string) => {
    if (command !== "git_status") return {};
    return {
      snapshot: {
        repo: { repo_root: "/code/app", branch: "main", upstream: null, is_detached: false },
        changed_files: status.files.map((path) => ({
          path,
          status: "modified",
          status_code: ".M",
          is_staged: false,
          is_unstaged: true,
          is_conflicted: false,
          original_path: null,
        })),
        ahead: 0,
        behind: 0,
        untracked_omitted: 0,
      },
    };
  },
}));

import { useGitStore } from "../git";

describe("loadStatus", () => {
  beforeEach(() => {
    status.files = ["a.ts"];
    useGitStore.setState({ repoPath: "/code/app", snapshot: null, isLoading: false, error: null });
  });

  it("does not notify subscribers when a refresh finds the same status", async () => {
    await useGitStore.getState().loadStatus();
    const before = useGitStore.getState().snapshot;
    const updates = vi.fn();
    const unsubscribe = useGitStore.subscribe(updates);

    await useGitStore.getState().loadStatus();
    unsubscribe();

    expect(updates).not.toHaveBeenCalled();
    expect(useGitStore.getState().snapshot).toBe(before);
  });

  it("stores the new status when files changed, without a loading flash", async () => {
    await useGitStore.getState().loadStatus();
    const loadingStates: boolean[] = [];
    const unsubscribe = useGitStore.subscribe((state) => loadingStates.push(state.isLoading));

    status.files = ["a.ts", "b.ts"];
    await useGitStore.getState().loadStatus();
    unsubscribe();

    expect(useGitStore.getState().snapshot?.changed_files.map((file) => file.path)).toEqual([
      "a.ts",
      "b.ts",
    ]);
    expect(loadingStates).not.toContain(true);
  });
});
