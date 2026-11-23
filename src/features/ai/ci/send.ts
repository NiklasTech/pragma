import type { ChatSession } from "@/shared/stores/ai";
import { deliverToSession } from "@/shell/chrome/commandLine/delivery";

import { runningRepositorySessions } from "../sessions/runningSessions";
import { isTerminalBracketedPaste, writeTerminal } from "../terminal/runner";
import { isShellSession } from "../terminal/shell";
import { bracketedPaste } from "../terminal/pasteMode";

const SUBMIT_DELAY_MS = 150;

/** The agent working in an environment: its newest running session that is not a plain shell. */
export function environmentAgentSession(
  rootPath: string,
  environmentId: string,
): ChatSession | null {
  const sessions = runningRepositorySessions(rootPath)
    .filter((session) => session.environmentId === environmentId && !isShellSession(session))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions[0] ?? null;
}

/** Sends a message with line breaks to an agent and submits it. */
export async function sendToAgent(session: ChatSession, text: string): Promise<void> {
  if (session.kind !== "terminal") {
    deliverToSession(session, text);
    return;
  }
  // Without bracketed paste every line break would submit a line of its own.
  const typed = isTerminalBracketedPaste(session.id)
    ? bracketedPaste(text)
    : text.replace(/\s*\n\s*/g, " ");
  await writeTerminal(session.id, typed);
  await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
  await writeTerminal(session.id, "\r");
}
