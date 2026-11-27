import { sessionCwd } from "@/features/ai/worktree/cwd";
import { useAIStore } from "@/shared/stores/ai";

/// The folder the active session works in: its worktree, else its repository.
export function useSessionFolder(): string | null {
  return useAIStore((state) => {
    const session = state.chatSessions.find((item) => item.id === state.activeChatSessionId);
    return session ? sessionCwd(session, state.workEnvironments, session.rootPath) : null;
  });
}
