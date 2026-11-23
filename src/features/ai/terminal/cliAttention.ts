import { PRAGMA_NOTIFY_TITLE } from "./attentionSignals";

// Claude Code runs hooks without a terminal, so /dev/tty fails; the sequence goes to the
// terminal of the CLI itself ($PPID), which is the PTY Pragma reads.
const FIND_TTY = `t=$(ps -o tty= -p $PPID 2>/dev/null | tr -d " "); case "$t" in ""|"??") exit 0;; esac`;

function printHook(body: string, input = "", args = ""): { type: "command"; command: string } {
  const sequence = `\\033]777;notify;${PRAGMA_NOTIFY_TITLE};${body}\\007`;
  return {
    type: "command",
    command: `${FIND_TTY}; ${input}printf "${sequence}"${args} > "/dev/$t" 2>/dev/null || true`,
  };
}

/// Tells Pragma the id of the session the CLI started or resumed, so it can be resumed elsewhere.
function sessionHook(): { type: "command"; command: string } {
  const readId = `s=$(tr -d " \\n" | grep -o "\\"session_id\\":\\"[A-Za-z0-9-]*\\"" | cut -d "\\"" -f4); [ -n "$s" ] || exit 0; `;
  return printHook("session:%s", readId, ' "$s"');
}

/// Claude Code only notifies in terminals it recognizes, so Pragma adds hooks for its events.
export function claudeAttentionSettings(): string {
  return JSON.stringify({
    hooks: {
      Stop: [{ hooks: [printHook("finished")] }],
      Notification: [
        { matcher: "permission_prompt|elicitation_dialog", hooks: [printHook("input")] },
      ],
      SessionStart: [{ hooks: [sessionHook()] }],
      StopFailure: [{ matcher: "rate_limit", hooks: [printHook("limit")] }],
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
