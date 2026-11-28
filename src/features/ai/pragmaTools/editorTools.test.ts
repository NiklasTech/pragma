import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
  openWorkspaceFile: vi.fn(),
  openDiff: vi.fn(),
  goToPosition: vi.fn(),
  openOverlay: vi.fn(),
  tabs: [] as Array<Record<string, unknown>>,
  activeTabId: null as string | null,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ chatSessions: [{ id: "s1", title: "Fix tests" }] }) },
}));
vi.mock("@/shared/stores/editor", () => ({
  useEditorStore: {
    getState: () => ({
      tabs: mocks.tabs,
      activeTabId: mocks.activeTabId,
      openDiff: mocks.openDiff,
      goToPosition: mocks.goToPosition,
    }),
  },
}));
vi.mock("@/shared/stores/overlays", () => ({
  useOverlayStore: { getState: () => ({ open: mocks.openOverlay }) },
}));
vi.mock("@/shell/mode/store", () => ({
  useUiModeStore: { getState: () => ({ setUiMode: vi.fn() }) },
}));
vi.mock("../components/openWorkspaceFile", () => ({ openWorkspaceFile: mocks.openWorkspaceFile }));

const { EDITOR_TOOLS, relativeTo } = await import("./editorTools");

const context = { sessionId: "s1", requestId: "r1", cwd: "/repo/tree", rootPath: "/repo" };

describe("relativeTo", () => {
  it("gives paths inside the working folder relative to it", () => {
    expect(relativeTo("/repo/tree/", "/repo/tree/src/a.ts")).toBe("src/a.ts");
    expect(() => relativeTo("/repo/tree", "/repo/treehouse/a.ts")).toThrow("outside");
    expect(() => relativeTo("/repo/tree", "/etc/hosts")).toThrow("outside");
  });
});

describe("EDITOR_TOOLS", () => {
  beforeEach(() => {
    for (const mock of [
      mocks.invoke,
      mocks.toast,
      mocks.openWorkspaceFile,
      mocks.openDiff,
      mocks.goToPosition,
      mocks.openOverlay,
    ]) {
      mock.mockReset();
    }
    mocks.tabs = [];
    mocks.activeTabId = null;
  });

  it("opens a file at a line and offers the editor", async () => {
    mocks.openWorkspaceFile.mockResolvedValue(true);
    mocks.activeTabId = "/repo/tree/src/a.ts";
    await expect(EDITOR_TOOLS.editor_open({ path: "src/a.ts", line: 12 }, context)).resolves.toBe(
      "Opened /repo/tree/src/a.ts at line 12 in Pragma's editor.",
    );
    expect(mocks.openWorkspaceFile).toHaveBeenCalledWith("/repo/tree/src/a.ts", null);
    expect(mocks.goToPosition).toHaveBeenCalledWith("/repo/tree/src/a.ts", { line: 12, column: 1 });
    expect(mocks.toast.mock.calls[0][0]).toBe("Fix tests opened a.ts at line 12");
  });

  it("shows the uncommitted diff, falling back to the staged one", async () => {
    const patch = "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n";
    mocks.invoke
      .mockResolvedValueOnce({ diff_text: "" })
      .mockResolvedValueOnce({ diff_text: patch });
    await expect(EDITOR_TOOLS.editor_show_diff({ path: "src/a.ts" }, context)).resolves.toContain(
      "staged changes of src/a.ts",
    );
    expect(mocks.invoke).toHaveBeenLastCalledWith("git_diff", {
      repoPath: "/repo/tree",
      path: "src/a.ts",
      staged: true,
    });
    expect(mocks.openDiff).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "src/a.ts",
        patchText: patch,
        staged: true,
        repoPath: "/repo/tree",
      }),
    );
  });

  it("says when a file has no changes", async () => {
    mocks.invoke.mockResolvedValue({ diff_text: "No diff available" });
    await expect(EDITOR_TOOLS.editor_show_diff({ path: "src/a.ts" }, context)).resolves.toBe(
      "src/a.ts has no uncommitted changes.",
    );
    expect(mocks.openDiff).not.toHaveBeenCalled();
  });

  it("lists open files with the active one and unsaved changes", async () => {
    mocks.tabs = [
      { kind: "file", id: "a", path: "/repo/a.ts", isModified: true },
      { kind: "diff", id: "d", path: "b.ts" },
      { kind: "file", id: "c", path: "/repo/c.ts", isModified: false },
    ];
    mocks.activeTabId = "c";
    await expect(EDITOR_TOOLS.editor_open_files({}, context)).resolves.toBe(
      "/repo/a.ts (unsaved changes)\n/repo/c.ts (active)",
    );
    mocks.tabs = [];
    await expect(EDITOR_TOOLS.editor_selection({}, context)).resolves.toContain(
      "No file is active",
    );
  });

  it("asks for a review with a button that opens the session's review", async () => {
    await EDITOR_TOOLS.review_request({ message: "Look at the store" }, context);
    const [title, options] = mocks.toast.mock.calls[0];
    expect(title).toBe("Fix tests asks you to review its changes");
    expect(options.description).toBe("Look at the store");
    options.action.onClick();
    expect(mocks.openOverlay).toHaveBeenCalledWith("review", "s1");
  });
});
