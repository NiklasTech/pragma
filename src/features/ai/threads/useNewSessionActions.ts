import { useCallback } from "react";

import { useAIStore, type CLIManifest } from "@/shared/stores/ai";
import { createTerminalSession } from "../panes/launch";
import { findLeaf } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { createSessionForChoice } from "../worktree/create";
import { useWorktreeChoiceStore } from "../worktree/remember";

export interface NewSessionActions {
  startAsk: () => Promise<void>;
  startAgentCheckout: () => Promise<void>;
  startAgentWorktree: () => Promise<void>;
  startTerminal: (manifest: CLIManifest) => Promise<void>;
  startConversation: (manifest: CLIManifest) => Promise<void>;
}

export function useNewSessionActions(
  rootPath: string | null,
  targetLeafId?: string,
): NewSessionActions {
  const place = useCallback(
    (sessionId: string) => {
      if (!rootPath) return;
      if (targetLeafId) {
        useAgentsPanesStore.getState().assignSession(rootPath, targetLeafId, sessionId);
        return;
      }

      const entry = useAgentsPanesStore.getState().trees[rootPath];
      const focusedLeafId = entry?.focusedLeafId ?? null;
      const leaf = focusedLeafId ? findLeaf(entry?.root ?? null, focusedLeafId) : null;
      if (leaf && leaf.sessionId === null) {
        useAgentsPanesStore.getState().assignSession(rootPath, leaf.id, sessionId);
      } else {
        useAgentsPanesStore.getState().openSession(rootPath, sessionId);
      }
    },
    [rootPath, targetLeafId],
  );

  const startAsk = useCallback(async () => {
    if (!rootPath) return;
    const session = await useAIStore
      .getState()
      .createChatSession(rootPath, { kind: "ask", environment: "checkout" });
    place(session.id);
  }, [place, rootPath]);

  const startAgentCheckout = useCallback(async () => {
    if (!rootPath) return;
    useWorktreeChoiceStore.getState().setChoice(rootPath, "checkout");
    const session = await createSessionForChoice(rootPath, "checkout");
    if (session) place(session.id);
  }, [place, rootPath]);

  const startAgentWorktree = useCallback(async () => {
    if (!rootPath) return;
    useWorktreeChoiceStore.getState().setChoice(rootPath, "worktree");
    const session = await createSessionForChoice(rootPath, "worktree");
    if (session) place(session.id);
  }, [place, rootPath]);

  const startTerminal = useCallback(
    async (manifest: CLIManifest) => {
      if (!rootPath) return;
      const session = await createTerminalSession(rootPath, manifest);
      place(session.id);
    },
    [place, rootPath],
  );

  const startConversation = useCallback(
    async (manifest: CLIManifest) => {
      if (!rootPath) return;
      const session = await useAIStore.getState().createChatSession(rootPath, {
        kind: "agent",
        environment: "checkout",
        cliProviderId: manifest.id,
        agentEngine: { kind: "cli", cliProviderId: manifest.id },
      });
      place(session.id);
    },
    [place, rootPath],
  );

  return {
    startAsk,
    startAgentCheckout,
    startAgentWorktree,
    startTerminal,
    startConversation,
  };
}
