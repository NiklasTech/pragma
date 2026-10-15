import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import {
  activateRepository,
  sessionRepository,
  showSessionInRepository,
} from "@/features/ai/sessions/openInRepository";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { useLayoutStore } from "@/shell/layout";
import { hasMountedAIPanel } from "@/shell/layout/aiPlacement";
import { resolveUiMode, useUiModeStore } from "@/shell/mode";

/** The focused chat session when it has a composer, or null. */
export function activeChatSession(): ChatSession | null {
  const { chatSessions, activeChatSessionId } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === activeChatSessionId);
  return session && session.kind !== "terminal" && !session.archived ? session : null;
}

/** Focuses the session in its repository and opens the surface that shows it in the current UI mode. */
export function revealChatSession(sessionId: string): void {
  useAIStore.getState().setActiveChatSession(sessionId);
  if (resolveUiMode(useUiModeStore.getState().uiMode, true) === "agents") {
    useNamedAgentsUiStore.getState().setView("sessions");
    void showSessionInRepository(sessionId, (rootPath, id) =>
      useAgentsPanesStore.getState().openSession(rootPath, id),
    );
    return;
  }
  void activateRepository(sessionRepository(sessionId));
  const layout = useLayoutStore.getState();
  if (layout.ai.mode === "hidden" && !hasMountedAIPanel(layout)) {
    layout.setAIMode("drawer-right");
  }
}
