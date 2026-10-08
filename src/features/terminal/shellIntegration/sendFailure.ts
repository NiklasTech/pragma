import { toast } from "sonner";

import { useAIStore, type ChatSession, type CreateChatSessionInit } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { sendToSession } from "@/features/ai/tasks/sessionRuns";
import { activeChatSession, revealChatSession } from "@/features/ai/revealChatSession";

import type { FinishedCommand } from "./commandTracker";
import { buildFailureMessage, type FailureIntent } from "./failureMessage";

const NEW_SESSION: Record<FailureIntent, CreateChatSessionInit> = {
  explain: { kind: "ask", environment: "checkout" },
  session: { kind: "agent", environment: "checkout", agentEngine: { kind: "builtin" } },
};

async function targetSession(rootPath: string, intent: FailureIntent): Promise<ChatSession> {
  const active = intent === "session" ? activeChatSession() : null;
  if (!active) return useAIStore.getState().createChatSession(rootPath, NEW_SESSION[intent]);
  // The chat must hold the earlier messages before the new one, or saving would drop them.
  if (active.messages.length === 0) {
    await useAIStore.getState().loadSessionMessages(rootPath, active.id);
  }
  return active;
}

/** Explains a failed command in a new chat or sends it to the active session; true once sent. */
export async function sendCommandFailure(
  command: FinishedCommand,
  intent: FailureIntent,
): Promise<boolean> {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) {
    toast.error("Open a folder to ask AI about the command");
    return false;
  }

  let session: ChatSession;
  try {
    session = await targetSession(rootPath, intent);
  } catch {
    toast.error("Could not open a session");
    return false;
  }

  revealChatSession(rootPath, session.id);
  const sent = await sendToSession(session.id, buildFailureMessage(command, intent));
  if (!sent) toast.error("Could not send the command. Try again once the session is idle.");
  return sent;
}
