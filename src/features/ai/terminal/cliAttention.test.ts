import { describe, expect, it } from "vite-plus/test";

import { claudeAttentionSettings, terminalLaunchCommand } from "./cliAttention";

describe("terminalLaunchCommand", () => {
  it("adds notification hooks to Claude Code", () => {
    expect(terminalLaunchCommand("anthropic-claude", "claude")).toBe(
      `claude --settings '${claudeAttentionSettings()}'`,
    );
  });

  it("turns on Codex desktop notifications", () => {
    expect(terminalLaunchCommand("openai-codex", "codex")).toBe("codex -c tui.notifications=true");
  });

  it("leaves other CLIs and empty commands unchanged", () => {
    expect(terminalLaunchCommand("google-gemini", "gemini")).toBe("gemini");
    expect(terminalLaunchCommand("anthropic-claude", "")).toBe("");
  });
});

describe("claudeAttentionSettings", () => {
  it("is JSON that survives single quoting", () => {
    const settings = claudeAttentionSettings();
    expect(settings).not.toContain("'");
    const parsed: unknown = JSON.parse(settings);
    expect(parsed).toMatchObject({
      hooks: {
        Stop: [{ hooks: [{ type: "command" }] }],
        Notification: [{ matcher: "permission_prompt|elicitation_dialog" }],
      },
    });
  });

  it("prints the OSC 777 sequences the terminal parser reads", () => {
    const settings = claudeAttentionSettings();
    expect(settings).toContain("\\\\033]777;notify;Pragma;finished\\\\007");
    expect(settings).toContain("\\\\033]777;notify;Pragma;input\\\\007");
  });

  it("writes to the terminal of the CLI because hooks run without one", () => {
    const settings = claudeAttentionSettings();
    expect(settings).toContain("ps -o tty= -p $PPID");
    expect(settings).toContain('> \\"/dev/$t\\"');
    expect(settings).not.toContain("/dev/tty");
  });
});
