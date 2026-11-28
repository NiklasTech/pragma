import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  hover: vi.fn(),
  sessions: [] as Array<{ id: string; rootPath: string; environmentId?: string }>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: mocks.sessions,
      workEnvironments: [{ id: "env-1", path: "/repo/.worktrees/a", setupStatus: "ready" }],
    }),
  },
}));
vi.mock("./codeTools", () => ({ CODE_TOOLS: { lsp_hover: mocks.hover } }));

const { handlePragmaToolRequest } = await import("./useAcpPragmaTools");

function reply() {
  return mocks.invoke.mock.calls[0]?.[1];
}

describe("handlePragmaToolRequest", () => {
  beforeEach(() => {
    mocks.invoke.mockReset().mockResolvedValue(undefined);
    mocks.hover.mockReset();
    mocks.sessions = [{ id: "s1", rootPath: "/repo", environmentId: "env-1" }];
  });

  it("runs the tool in the session's worktree and replies with its text", async () => {
    mocks.hover.mockResolvedValue("const x: number");
    await handlePragmaToolRequest({
      requestId: "r1",
      chatSessionId: "s1",
      tool: "lsp_hover",
      arguments: { path: "a.ts" },
    });
    expect(mocks.hover).toHaveBeenCalledWith(
      { path: "a.ts" },
      { sessionId: "s1", requestId: "r1", cwd: "/repo/.worktrees/a", rootPath: "/repo" },
    );
    expect(reply()).toEqual({ req: { request_id: "r1", ok: true, text: "const x: number" } });
  });

  it("reports failures and unknown tools as errors", async () => {
    mocks.hover.mockRejectedValue(new Error("No language server supports a.txt"));
    await handlePragmaToolRequest({
      requestId: "r1",
      chatSessionId: "s1",
      tool: "lsp_hover",
      arguments: {},
    });
    expect(reply()).toEqual({
      req: { request_id: "r1", ok: false, text: "No language server supports a.txt" },
    });
    mocks.invoke.mockClear();
    await handlePragmaToolRequest({
      requestId: "r2",
      chatSessionId: "s1",
      tool: "nope",
      arguments: {},
    });
    expect(reply()).toEqual({ req: { request_id: "r2", ok: false, text: "Unknown tool: nope" } });
  });

  it("leaves requests of sessions in other windows to them", async () => {
    await handlePragmaToolRequest({
      requestId: "r1",
      chatSessionId: "other",
      tool: "lsp_hover",
      arguments: {},
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
