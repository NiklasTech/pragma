import { toast } from "sonner";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { createAgentChat } from "@/features/ai/named-agents/createChat";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { useAgentsPanesStore } from "@/features/ai/panes/store";

import { openBlockers } from "./organize";
import { sendToSession, stopLiveSession } from "./sessionRuns";
import { useTasksStore } from "./store";
import type { Task } from "./types";
import { useTasksUiStore } from "./ui";
import { buildTaskMessage } from "./validation";

export const RESUME_MESSAGE = "Continue the task.";

function focusSession(rootPath: string, sessionId: string): void {
  useTasksUiStore.getState().closeBoard();
  useNamedAgentsUiStore.getState().setView("sessions");
  useAIStore.getState().setActiveChatSession(sessionId);
  useAgentsPanesStore.getState().openSession(rootPath, sessionId);
}

async function send(sessionId: string, text: string): Promise<void> {
  const sent = await sendToSession(sessionId, text);
  if (!sent) toast.error("Could not send the message to the session");
}

export async function runTask(rootPath: string, task: Task): Promise<void> {
  if (openBlockers(task, useTasksStore.getState().tasks).length > 0) {
    toast.error("Finish the blocking tasks first");
    return;
  }
  const agent = task.agentId
    ? useNamedAgentsStore.getState().agents.find((item) => item.id === task.agentId)
    : undefined;
  if (task.agentId && !agent) {
    toast.error("The assigned agent no longer exists");
    return;
  }

  const title = task.title.trim();
  let session: ChatSession;
  try {
    session = agent
      ? await createAgentChat(rootPath, agent, title)
      : await useAIStore.getState().createChatSession(rootPath, {
          title,
          kind: "agent",
          environment: "checkout",
          agentEngine: { kind: "builtin" },
        });
  } catch {
    toast.error("Could not start the task");
    return;
  }

  try {
    await useTasksStore.getState().linkSession(task.id, session.id);
  } catch {
    toast.error("Could not save the task");
  }

  focusSession(rootPath, session.id);
  await send(session.id, buildTaskMessage(task));
}

export async function resumeTask(rootPath: string, task: Task): Promise<void> {
  const sessionId = task.sessionId;
  if (!sessionId) return;

  const { chatSessions, loadSessionMessages } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === sessionId);
  if (!session) {
    toast.error("The linked session no longer exists");
    return;
  }

  // The chat must hold the earlier messages before the new one, or saving would drop them.
  if (session.messages.length === 0) {
    try {
      await loadSessionMessages(rootPath, sessionId);
    } catch {
      toast.error("Could not load the session");
      return;
    }
  }

  focusSession(rootPath, sessionId);
  await send(sessionId, RESUME_MESSAGE);
}

export function stopTask(task: Task): void {
  if (!task.sessionId || !stopLiveSession(task.sessionId)) {
    toast.error("The session is not running");
  }
}
