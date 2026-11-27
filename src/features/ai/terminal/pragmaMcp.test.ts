import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  sessions: [] as Array<{ id: string; cliProviderId?: string }>,
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ chatSessions: mocks.sessions }) },
}));

const { withPragmaMcp } = await import("./pragmaMcp");

describe("withPragmaMcp", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.sessions = [
      { id: "claude-1", cliProviderId: "anthropic-claude" },
      { id: "codex-1", cliProviderId: "openai-codex" },
      { id: "shell-1" },
    ];
  });

  it("appends the session's MCP config to Claude Code, last", async () => {
    mocks.invoke.mockResolvedValue("/data/mcp-sessions/claude-1.json");
    await expect(withPragmaMcp("claude-1", 'claude --resume abc "Continue"')).resolves.toBe(
      `claude --resume abc "Continue" --mcp-config '/data/mcp-sessions/claude-1.json'`,
    );
    expect(mocks.invoke).toHaveBeenCalledWith("child_session_mcp_config", {
      chatSessionId: "claude-1",
    });
  });

  it("quotes paths with spaces and quotes", async () => {
    mocks.invoke.mockResolvedValue("/Users/a b/it's.json");
    await expect(withPragmaMcp("claude-1", "claude")).resolves.toBe(
      `claude --mcp-config '/Users/a b/it'\\''s.json'`,
    );
  });

  it("leaves other CLIs, shells and failures unchanged", async () => {
    await expect(withPragmaMcp("codex-1", "codex")).resolves.toBe("codex");
    await expect(withPragmaMcp("shell-1", "zsh")).resolves.toBe("zsh");
    mocks.invoke.mockRejectedValue(new Error("no bridge"));
    await expect(withPragmaMcp("claude-1", "claude")).resolves.toBe("claude");
  });
});
