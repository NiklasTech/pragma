import { PRAGMA_NOTIFY_TITLE, type TerminalAttention } from "./attentionSignals";

function notifyHook(attention: TerminalAttention): { type: "command"; command: string } {
  // Hooks run without the TUI's stdout, so the sequence goes to the controlling terminal.
  const sequence = `\\033]777;notify;${PRAGMA_NOTIFY_TITLE};${attention}\\007`;
  return { type: "command", command: `printf "${sequence}" 2>/dev/null >/dev/tty || true` };
}

/// Claude Code only notifies in terminals it recognizes, so Pragma adds hooks for its events.
export function claudeAttentionSettings(): string {
  return JSON.stringify({
    hooks: {
      Stop: [{ hooks: [notifyHook("finished")] }],
      Notification: [
        { matcher: "permission_prompt|elicitation_dialog", hooks: [notifyHook("input")] },
      ],
    },
  });
}

function isWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);
}

/// The command for a CLI terminal session, with the options that make the CLI report attention.
export function terminalLaunchCommand(cliProviderId: string, command: string): string {
  if (!command || isWindows()) return command;
  switch (cliProviderId) {
    case "anthropic-claude":
      return `${command} --settings '${claudeAttentionSettings()}'`;
    case "openai-codex":
      return `${command} -c tui.notifications=true`;
    default:
      return command;
  }
}
