import { invoke } from "@tauri-apps/api/core";

import type { ChatSession } from "@/shared/stores/ai";

type ResumableSession = Pick<
  ChatSession,
  "kind" | "cliProviderId" | "cliSessionId" | "cliAccountDir"
>;

const CLI_SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

/** The id of the conversation the CLI in this terminal can pick up again, if there is one. */
export function resumableCliSession(session: ResumableSession): string | null {
  if (session.kind !== "terminal" || session.cliProviderId !== "anthropic-claude") return null;
  const id = session.cliSessionId;
  return id && CLI_SESSION_ID.test(id) ? id : null;
}

/** The command that goes on with the terminal's conversation, else `command` as it is. */
export async function resumeCommand(session: ResumableSession, command: string): Promise<string> {
  const id = resumableCliSession(session);
  if (!id) return command;
  const exists = await invoke<boolean>("claude_session_exists", {
    sessionId: id,
    configDir: session.cliAccountDir ?? null,
  }).catch(() => false);
  return exists ? `${command} --resume ${id}` : command;
}
