import { useCallback } from "react";
import { toast } from "sonner";

import type { CLIManifest } from "@/shared/stores/ai";
import { createTerminalSession } from "../panes/launch";
import { findLeaf } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { activateRepository } from "../sessions/openInRepository";
import { startSession, type StartSessionRequest } from "../sessions/start";
import type { SessionMenuCliAction } from "./session-menu";

/** The kind of session that joins another session's worktree. */
export type JoinTarget =
  | { kind: "ask" | "agent" }
  | { kind: "cli"; manifest: CLIManifest; action: SessionMenuCliAction };

export interface NewSessionActions {
  startAsk: () => Promise<void>;
  startAgentCheckout: () => Promise<void>;
  startAgentWorktree: () => Promise<void>;
  startTerminal: (manifest: CLIManifest) => Promise<void>;
  startConversation: (manifest: CLIManifest) => Promise<void>;
  joinWorktree: (environmentId: string, target: JoinTarget) => Promise<void>;
}

function cliConversationInit(manifest: CLIManifest): StartSessionRequest["init"] {
  return {
    kind: "agent",
    cliProviderId: manifest.id,
    agentEngine: { kind: "cli", cliProviderId: manifest.id },
  };
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
      void activateRepository(rootPath);
    },
    [rootPath, targetLeafId],
  );

  const start = useCallback(
    async (request: StartSessionRequest) => {
      if (!rootPath) return;
      try {
        const session = await startSession(rootPath, request);
        place(session.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start the session");
      }
    },
    [place, rootPath],
  );

  const startAsk = useCallback(() => start({ init: { kind: "ask" } }), [start]);

  const startAgentCheckout = useCallback(
    () => start({ init: { kind: "agent" }, environment: "checkout" }),
    [start],
  );

  const startAgentWorktree = useCallback(
    () => start({ init: { kind: "agent" }, environment: "worktree" }),
    [start],
  );

  const startTerminal = useCallback(
    async (manifest: CLIManifest, environment?: Pick<StartSessionRequest, "sameEnvironmentAs">) => {
      if (!rootPath) return;
      try {
        const session = await createTerminalSession(rootPath, manifest, { environment });
        place(session.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not start ${manifest.name}`);
      }
    },
    [place, rootPath],
  );

  const startConversation = useCallback(
    (manifest: CLIManifest) => start({ init: cliConversationInit(manifest) }),
    [start],
  );

  const joinWorktree = useCallback(
    (environmentId: string, target: JoinTarget) => {
      const sameEnvironmentAs = { environment: "worktree" as const, environmentId };
      if (target.kind !== "cli") return start({ init: { kind: target.kind }, sameEnvironmentAs });
      if (target.action === "terminal")
        return startTerminal(target.manifest, { sameEnvironmentAs });
      return start({ init: cliConversationInit(target.manifest), sameEnvironmentAs });
    },
    [start, startTerminal],
  );

  return {
    startAsk,
    startAgentCheckout,
    startAgentWorktree,
    startTerminal,
    startConversation,
    joinWorktree,
  };
}
