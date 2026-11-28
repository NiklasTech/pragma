import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  approve: vi.fn(),
  needsApproval: true,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: [{ id: "s1", environmentId: "env-1" }],
      workEnvironments: [
        {
          id: "env-1",
          kind: "worktree",
          path: "/repo/.wt/a",
          branch: "feat/a",
          baseBranch: "main",
          setupStatus: "ready",
        },
      ],
    }),
  },
}));
vi.mock("../children/acpSpawn", () => ({ requestSpawnApproval: mocks.approve }));
vi.mock("./rename", () => ({ editsNeedApproval: () => mocks.needsApproval }));

const { WORKSPACE_TOOLS } = await import("./workspaceTools");

const context = { sessionId: "s1", requestId: "r1", cwd: "/repo/.wt/a", rootPath: "/repo" };
const entries = [
  { id: "1764340000000", kind: "snapshot", timestamp: 1764340000, author: "Pragma", message: "" },
  { id: "abc123", kind: "git", timestamp: 1764000000, author: "Niklas", message: "Add store" },
];

function answer(command: string, args: Record<string, unknown>): unknown {
  switch (command) {
    case "git_status":
      return {
        snapshot: {
          repo: { branch: "feat/a", upstream: null, is_detached: false },
          changed_files: [{ path: "src/a.ts" }],
          ahead: 0,
          behind: 0,
        },
      };
    case "run_list_configs":
      return [{ name: "dev", command: "npm run dev" }];
    case "run_detect_configs":
      return [
        { name: "dev", command: "npm run dev" },
        { name: "test", command: "npm test" },
      ];
    case "list_workspace_dir":
      return { entries: [{ name: "package.json" }, { name: "tsconfig.json" }, { name: "src" }] };
    case "local_history_entries":
      return { entries };
    case "local_history_diff":
      return { patchText: `diff for ${String(args.entryId)}` };
    default:
      return undefined;
  }
}

describe("WORKSPACE_TOOLS", () => {
  beforeEach(() => {
    mocks.invoke.mockReset().mockImplementation(async (command, args) => answer(command, args));
    mocks.approve.mockReset();
    mocks.needsApproval = true;
  });

  it("describes the worktree, git state, run configurations and stack", async () => {
    const text = await WORKSPACE_TOOLS.workspace_info({}, context);
    expect(text).toBe(
      [
        "Project: /repo",
        "Working folder: /repo/.wt/a",
        "Worktree on branch feat/a, from main.",
        "Git: branch feat/a\nChanged files:\n  src/a.ts",
        "Run configurations:\n  dev: npm run dev\n  test: npm test",
        "Stack: Node.js, TypeScript.",
      ].join("\n"),
    );
    expect(mocks.invoke).toHaveBeenCalledWith("git_status", { repoPath: "/repo/.wt/a" });
  });

  it("lists a file's versions and shows one version's diff", async () => {
    const list = await WORKSPACE_TOOLS.local_history({ path: "src/a.ts" }, context);
    expect(list).toContain("Versions of /repo/.wt/a/src/a.ts, newest first:");
    expect(list).toContain("1764340000000  2025-11-28T14:26:40.000Z  snapshot");
    expect(list).toContain("abc123  2025-11-24T16:00:00.000Z  commit by Niklas: Add store");
    await expect(
      WORKSPACE_TOOLS.local_history({ path: "src/a.ts", entry: "abc123" }, context),
    ).resolves.toBe("What this commit changed in the file:\ndiff for abc123");
    await expect(
      WORKSPACE_TOOLS.local_history({ path: "src/a.ts", entry: "nope" }, context),
    ).rejects.toThrow("No version nope");
  });

  it("restores a version only once the user allows it", async () => {
    mocks.approve.mockResolvedValue(false);
    await expect(
      WORKSPACE_TOOLS.local_history_restore({ path: "src/a.ts", entry: "abc123" }, context),
    ).resolves.toContain("did not allow");
    expect(mocks.invoke).not.toHaveBeenCalledWith("local_history_restore", expect.anything());
    mocks.approve.mockResolvedValue(true);
    await expect(
      WORKSPACE_TOOLS.local_history_restore({ path: "src/a.ts", entry: "abc123" }, context),
    ).resolves.toBe("Restored /repo/.wt/a/src/a.ts to version abc123.");
    expect(mocks.invoke).toHaveBeenCalledWith("local_history_restore", {
      filePath: "/repo/.wt/a/src/a.ts",
      entryId: "abc123",
      kind: "git",
    });
  });
});
