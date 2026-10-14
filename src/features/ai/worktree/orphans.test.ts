import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  removeWorktree: vi.fn(async () => true),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  removeWorktrees: true,
  orphans: [] as unknown[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: { warning: mocks.toastWarning, error: mocks.toastError } }));
vi.mock("./cleanup", () => ({
  autoRemoveWorktrees: () => mocks.removeWorktrees,
  isPragmaBranch: (branch: string) => /^pragma\/[0-9a-f]{8}(-\d+)?$/.test(branch),
  removeWorktree: mocks.removeWorktree,
}));

import { removeOrphanWorktrees } from "./orphans";

const CLEAN = {
  id: "11111111-1111-1111-1111-111111111111",
  path: "/data/worktrees/hash/11111111-1111-1111-1111-111111111111",
  branch: "pragma/11111111",
  dirty: false,
};
const DIRTY = {
  id: "22222222-1111-1111-1111-111111111111",
  path: "/data/worktrees/hash/22222222-1111-1111-1111-111111111111",
  branch: "pragma/22222222",
  dirty: true,
};

describe("removeOrphanWorktrees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.removeWorktrees = true;
    mocks.orphans = [CLEAN, DIRTY];
    mocks.invoke.mockImplementation(async () => mocks.orphans);
  });

  it("removes clean orphans with their merged branch and reports dirty ones once", async () => {
    await removeOrphanWorktrees("/repo/a");

    expect(mocks.invoke).toHaveBeenCalledWith("git_session_worktree_orphans", {
      repoPath: "/repo/a",
    });
    expect(mocks.removeWorktree).toHaveBeenCalledTimes(1);
    expect(mocks.removeWorktree).toHaveBeenCalledWith(
      "/repo/a",
      expect.objectContaining({ id: CLEAN.id, path: CLEAN.path, branch: CLEAN.branch }),
      false,
    );
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
    expect(mocks.toastWarning.mock.calls[0][1].description).toContain(DIRTY.path);
  });

  it("sweeps a workspace only once per app run", async () => {
    await removeOrphanWorktrees("/repo/b");
    await removeOrphanWorktrees("/repo/b");

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
  });

  it("keeps orphans on branches Pragma did not create", async () => {
    mocks.orphans = [
      { ...CLEAN, branch: "main" },
      { ...CLEAN, branch: null },
    ];

    await removeOrphanWorktrees("/repo/c");

    expect(mocks.removeWorktree).not.toHaveBeenCalled();
    expect(mocks.toastWarning).not.toHaveBeenCalled();
  });

  it("does nothing when automatic removal is off or no folder is open", async () => {
    mocks.removeWorktrees = false;
    await removeOrphanWorktrees("/repo/d");
    mocks.removeWorktrees = true;
    await removeOrphanWorktrees("default");

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("continues with the next orphan when one cannot be removed", async () => {
    const second = { ...CLEAN, id: "33333333-1111-1111-1111-111111111111", path: "/wt/3" };
    mocks.orphans = [CLEAN, second];
    mocks.removeWorktree.mockRejectedValueOnce(new Error("locked"));

    await removeOrphanWorktrees("/repo/e");

    expect(mocks.removeWorktree).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });
});
