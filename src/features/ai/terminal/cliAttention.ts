import { PRAGMA_NOTIFY_TITLE, type TerminalAttention } from "./attentionSignals";

function notifyHook(attention: TerminalAttention): { type: "command"; command: string } {
  // Claude Code runs hooks without a terminal, so /dev/tty fails; the sequence goes to the
  // terminal of the CLI itself ($PPID), which is the PTY Pragma reads.
  const sequence = `\\033]777;notify;${PRAGMA_NOTIFY_TITLE};${attention}\\007`;
  const tty = `t=$(ps -o tty= -p $PPID 2>/dev/null | tr -d " "); case "$t" in ""|"??") exit 0;; esac`;
  return {
    type: "command",
    command: `${tty}; printf "${sequence}" > "/dev/$t" 2>/dev/null || true`,
  };
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
