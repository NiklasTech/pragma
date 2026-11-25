import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { resumableCliSession, resumeCommand } from "./resume";

const claude = {
  kind: "terminal",
  cliProviderId: "anthropic-claude",
  cliSessionId: "0f2c7f0a-1111-2222-3333-444455556666",
} as const;

describe("resumeCommand", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("resumes a conversation the account still holds", async () => {
    invoke.mockResolvedValue(true);
    expect(await resumeCommand({ ...claude, cliAccountDir: "/acc" }, "claude")).toBe(
      `claude --resume ${claude.cliSessionId}`,
    );
    expect(invoke).toHaveBeenCalledWith("claude_session_exists", {
      sessionId: claude.cliSessionId,
      configDir: "/acc",
    });
  });

  it("starts fresh without a transcript or when the check fails", async () => {
    invoke.mockResolvedValueOnce(false);
    expect(await resumeCommand(claude, "claude")).toBe("claude");
    invoke.mockRejectedValueOnce("no account");
    expect(await resumeCommand(claude, "claude")).toBe("claude");
  });

  it("leaves other CLIs, chats and odd ids alone", async () => {
    expect(resumableCliSession({ ...claude, cliProviderId: "openai-codex" })).toBeNull();
    expect(resumableCliSession({ ...claude, kind: "agent" })).toBeNull();
    expect(resumableCliSession({ ...claude, cliSessionId: "x; rm -rf" })).toBeNull();
    expect(await resumeCommand({ ...claude, cliSessionId: undefined }, "claude")).toBe("claude");
    expect(invoke).not.toHaveBeenCalled();
  });
});
