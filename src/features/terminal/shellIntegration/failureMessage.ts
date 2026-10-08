import type { FinishedCommand } from "./commandTracker";

export type FailureIntent = "explain" | "session";

const INSTRUCTIONS: Record<FailureIntent, string> = {
  explain: "Explain why this terminal command failed and how to fix it.",
  session: "This terminal command failed. Find the cause and fix it.",
};

function fenced(text: string, language = ""): string {
  const longestRun = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence}${language}\n${text}\n${fence}`;
}

/** The chat message that hands a failed command, its exit code and its output to the AI. */
export function buildFailureMessage(command: FinishedCommand, intent: FailureIntent): string {
  const exitCode = command.exitCode ?? "unknown";
  return [
    INSTRUCTIONS[intent],
    `Command (exit code ${exitCode}):\n${fenced(command.command || "(unknown command)", "sh")}`,
    `Output:\n${fenced(command.output || "(no output)")}`,
  ].join("\n\n");
}
