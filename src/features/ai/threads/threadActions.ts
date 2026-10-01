import { loadSessionMessages, saveSessionMessages } from "@/shared/lib/chat-storage";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

/// Copies the conversation into a new thread; the worktree stays with the original.
export async function duplicateThread(rootPath: string, source: ChatSession): Promise<void> {
  const { createChatSession, updateChatSessionMessages } = useAIStore.getState();
  const messages =
    source.messages.length > 0 ? source.messages : await loadSessionMessages(rootPath, source.id);

  const copy = await createChatSession(
    rootPath,
    {
      title: `${source.title} (copy)`,
      kind: source.kind,
      cliProviderId: source.cliProviderId,
      agentId: source.agentId,
      agentEngine: source.agentEngine,
      category: source.category,
    },
    { activate: false },
  );
  if (messages.length === 0) return;

  await saveSessionMessages(rootPath, copy.id, messages);
  updateChatSessionMessages(copy.id, messages);
}

export async function duplicateThreads(rootPath: string, sessionIds: string[]): Promise<void> {
  const sources = useAIStore.getState().chatSessions.filter((s) => sessionIds.includes(s.id));
  for (const source of sources) await duplicateThread(rootPath, source);
}

export async function setThreadsCategory(
  rootPath: string,
  sessionIds: string[],
  category: string | null,
): Promise<void> {
  const { chatSessions, updateChatSession } = useAIStore.getState();
  for (const session of chatSessions.filter((s) => sessionIds.includes(s.id))) {
    if ((session.category ?? null) === category) continue;
    const next: ChatSession = { ...session };
    if (category) next.category = category;
    else delete next.category;
    await updateChatSession(rootPath, next);
  }
}
