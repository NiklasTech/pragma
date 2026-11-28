import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  rename: vi.fn(),
  apply: vi.fn(),
  approve: vi.fn(),
  autoApprove: "never",
  yolo: false,
}));

vi.mock("@/features/agent/lspTools", () => ({
  withLspDocument: async (_path: string, run: (language: string, content: string) => unknown) =>
    run("typescript", "const total = 1;\nexport { total };"),
  locateSymbol: () => ({ line: 0, character: 6 }),
}));
vi.mock("@/features/editor/lsp/client", () => ({ lspRename: mocks.rename }));
vi.mock("@/features/editor/lsp/workspaceEdits", () => ({ applyWorkspaceEdits: mocks.apply }));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: { getState: () => ({ ai: { yoloMode: mocks.yolo } }) },
}));
vi.mock("@/shared/stores/workspaceSettings/effective", () => ({
  getAgentSettings: () => ({ autoApprove: mocks.autoApprove }),
}));
vi.mock("../children/acpSpawn", () => ({ requestSpawnApproval: mocks.approve }));

const { renameSymbol } = await import("./rename");

const context = { sessionId: "s1", requestId: "r1", cwd: "/p", rootPath: "/p" };
const args = { path: "src/a.ts", line: 1, symbol: "total", new_name: "sum" };
const edits = [
  { filePath: "/p/src/a.ts", edits: [{}, {}] },
  { filePath: "/p/src/b.ts", edits: [] },
];

describe("renameSymbol", () => {
  beforeEach(() => {
    mocks.rename.mockReset().mockResolvedValue(edits);
    mocks.apply.mockReset().mockResolvedValue(undefined);
    mocks.approve.mockReset();
    mocks.autoApprove = "never";
    mocks.yolo = false;
  });

  it("asks the user, then applies the language server's edits", async () => {
    mocks.approve.mockResolvedValue(true);
    const text = await renameSymbol(args, context);
    expect(mocks.rename).toHaveBeenCalledWith("typescript", "/p/src/a.ts", 0, 6, "sum");
    expect(mocks.approve).toHaveBeenCalledWith("s1", {
      toolCallId: "r1",
      toolName: "lsp_rename",
      args,
      description: "/p/src/a.ts (2)",
    });
    expect(mocks.apply).toHaveBeenCalledWith(edits);
    expect(text).toBe('Renamed "total" to "sum" in:\n/p/src/a.ts (2)');
  });

  it("changes nothing when the user denies", async () => {
    mocks.approve.mockResolvedValue(false);
    await expect(renameSymbol(args, context)).resolves.toContain("did not allow");
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("follows the setting that approves edits on its own", async () => {
    mocks.autoApprove = "edits";
    await renameSymbol(args, context);
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.apply).toHaveBeenCalled();
  });

  it("needs a new name and reports when nothing would change", async () => {
    await expect(renameSymbol({ ...args, new_name: " " }, context)).rejects.toThrow("new_name");
    mocks.rename.mockResolvedValue([]);
    await expect(renameSymbol(args, context)).resolves.toContain("nothing to rename");
  });
});
