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
      { id: "gemini-1", cliProviderId: "google-gemini" },
      { id: "shell-1" },
    ];
  });

  it("appends the options the backend gives for the session's CLI, last", async () => {
    mocks.invoke.mockResolvedValue(["--mcp-config", "/data/mcp-sessions/claude-1.json"]);
    await expect(withPragmaMcp("claude-1", 'claude --resume abc "Continue"')).resolves.toBe(
      `claude --resume abc "Continue" --mcp-config /data/mcp-sessions/claude-1.json`,
    );
    expect(mocks.invoke).toHaveBeenCalledWith("child_session_mcp_config", {
      chatSessionId: "claude-1",
      providerId: "anthropic-claude",
    });
  });

  it("quotes options with spaces and quotes", async () => {
    mocks.invoke.mockResolvedValue(["--mcp-config", "/Users/a b/it's.json"]);
    await expect(withPragmaMcp("claude-1", "claude")).resolves.toBe(
      `claude --mcp-config '/Users/a b/it'\\''s.json'`,
    );
    mocks.invoke.mockResolvedValue(["-c", "mcp_servers.pragma.command='/Pragma Dev/app'"]);
    await expect(withPragmaMcp("codex-1", "codex")).resolves.toBe(
      `codex -c 'mcp_servers.pragma.command='\\''/Pragma Dev/app'\\'''`,
    );
  });

  it("leaves CLIs without an option, shells and failures unchanged", async () => {
    mocks.invoke.mockResolvedValue(null);
    await expect(withPragmaMcp("gemini-1", "gemini")).resolves.toBe("gemini");
    await expect(withPragmaMcp("shell-1", "zsh")).resolves.toBe("zsh");
    mocks.invoke.mockRejectedValue(new Error("no bridge"));
    await expect(withPragmaMcp("claude-1", "claude")).resolves.toBe("claude");
  });
});
