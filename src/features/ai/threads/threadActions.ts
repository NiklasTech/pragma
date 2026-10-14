import { loadSessionMessages, saveSessionMessages } from "@/shared/lib/chat-storage";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { startSession } from "../sessions/start";

/// Copies the conversation into a new thread that works in the same environment.
export async function duplicateThread(source: ChatSession): Promise<void> {
  const { updateChatSessionMessages } = useAIStore.getState();
  const messages =
    source.messages.length > 0
      ? source.messages
      : await loadSessionMessages(source.rootPath, source.id);

  const copy = await startSession(source.rootPath, {
    init: {
      title: `${source.title} (copy)`,
      kind: source.kind,
      cliProviderId: source.cliProviderId,
      agentId: source.agentId,
      agentEngine: source.agentEngine,
      category: source.category,
    },
    sameEnvironmentAs: source,
    activate: false,
  });
  if (messages.length === 0) return;

  await saveSessionMessages(copy.rootPath, copy.id, messages);
  updateChatSessionMessages(copy.id, messages);
}

export async function duplicateThreads(sessionIds: string[]): Promise<void> {
  const sources = useAIStore.getState().chatSessions.filter((s) => sessionIds.includes(s.id));
  for (const source of sources) await duplicateThread(source);
}

export async function setThreadsCategory(
  sessionIds: string[],
  category: string | null,
): Promise<void> {
  const { chatSessions, updateChatSession } = useAIStore.getState();
  for (const session of chatSessions.filter((s) => sessionIds.includes(s.id))) {
    if ((session.category ?? null) === category) continue;
    const next: ChatSession = { ...session };
    if (category) next.category = category;
    else delete next.category;
    await updateChatSession(next);
  }
}
