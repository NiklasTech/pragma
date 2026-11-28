import { sessionCwd } from "@/features/ai/worktree/cwd";
import { useAIStore } from "@/shared/stores/ai";

/// The folder a session works in, the active one by default: its worktree, else its repository.
export function useSessionFolder(sessionId?: string | null): string | null {
  return useAIStore((state) => {
    const id = sessionId ?? state.activeChatSessionId;
    const session = state.chatSessions.find((item) => item.id === id);
    return session ? sessionCwd(session, state.workEnvironments, session.rootPath) : null;
  });
}
