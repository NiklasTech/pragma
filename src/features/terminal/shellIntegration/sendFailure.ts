import { toast } from "sonner";

import { useAIStore, type ChatSession, type CreateChatSessionInit } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { sendToSession } from "@/features/ai/tasks/sessionRuns";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { useLayoutStore } from "@/shell/layout";
import { hasMountedAIPanel } from "@/shell/layout/aiPlacement";
import { resolveUiMode, useUiModeStore } from "@/shell/mode";

import type { FinishedCommand } from "./commandTracker";
import { buildFailureMessage, type FailureIntent } from "./failureMessage";

const NEW_SESSION: Record<FailureIntent, CreateChatSessionInit> = {
  explain: { kind: "ask", environment: "checkout" },
  session: { kind: "agent", environment: "checkout", agentEngine: { kind: "builtin" } },
};

function activeChatSession(): ChatSession | null {
  const { chatSessions, activeChatSessionId } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === activeChatSessionId);
  return session && session.kind !== "terminal" && !session.archived ? session : null;
}

async function targetSession(rootPath: string, intent: FailureIntent): Promise<ChatSession> {
  const active = intent === "session" ? activeChatSession() : null;
  if (!active) return useAIStore.getState().createChatSession(rootPath, NEW_SESSION[intent]);
  // The chat must hold the earlier messages before the new one, or saving would drop them.
  if (active.messages.length === 0) {
    await useAIStore.getState().loadSessionMessages(rootPath, active.id);
  }
  return active;
}

function revealSession(rootPath: string, sessionId: string): void {
  useAIStore.getState().setActiveChatSession(sessionId);
  if (resolveUiMode(useUiModeStore.getState().uiMode, true) === "agents") {
    useNamedAgentsUiStore.getState().setView("sessions");
    useAgentsPanesStore.getState().openSession(rootPath, sessionId);
    return;
  }
  const layout = useLayoutStore.getState();
  if (layout.ai.mode === "hidden" && !hasMountedAIPanel(layout)) {
    layout.setAIMode("drawer-right");
  }
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

  revealSession(rootPath, session.id);
  const sent = await sendToSession(session.id, buildFailureMessage(command, intent));
  if (!sent) toast.error("Could not send the command. Try again once the session is idle.");
  return sent;
}
