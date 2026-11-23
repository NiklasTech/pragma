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
        SessionStart: [{ hooks: [{ type: "command" }] }],
        StopFailure: [{ matcher: "rate_limit" }],
      },
    });
  });

  it("reports the session id and the usage limit", () => {
    const parsed = JSON.parse(claudeAttentionSettings()) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const session = parsed.hooks.SessionStart?.[0]?.hooks[0]?.command ?? "";
    const limit = parsed.hooks.StopFailure?.[0]?.hooks[0]?.command ?? "";
    expect(session).toContain('grep -o "\\"session_id\\":\\"[A-Za-z0-9-]*\\""');
    expect(session).toContain('printf "\\033]777;notify;Pragma;session:%s\\007" "$s"');
    expect(limit).toContain('printf "\\033]777;notify;Pragma;limit\\007"');
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
