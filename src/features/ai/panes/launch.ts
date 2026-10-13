import type { ChatSession, CLIManifest } from "@/shared/stores/ai";

import { groupEnvironmentRequest, type GroupEnvironment } from "../sessions/group";
import { startSession, type StartSessionRequest } from "../sessions/start";
import { terminalSessionTitle } from "../terminal/title";
import { MAX_PANES } from "./operations";
import { useAgentsPanesStore } from "./store";

export function createTerminalSession(
  rootPath: string,
  manifest: CLIManifest,
  options?: {
    activate?: boolean;
    title?: string;
    environment?: Pick<StartSessionRequest, "environment" | "sameEnvironmentAs">;
  },
): Promise<ChatSession> {
  return startSession(rootPath, {
    init: {
      kind: "terminal",
      cliProviderId: manifest.id,
      title: options?.title ?? terminalSessionTitle(manifest.name),
    },
    ...options?.environment,
    activate: options?.activate,
  });
}

/// Starts `count` new terminals of one CLI one after another and shows exactly them in the grid.
export async function launchTerminals(
  rootPath: string,
  manifest: CLIManifest,
  count: number,
  mode: GroupEnvironment,
): Promise<void> {
  const total = Math.min(Math.max(Math.round(count), 1), MAX_PANES);
  const baseTitle = terminalSessionTitle(manifest.name);
  const sessions: ChatSession[] = [];
  for (let index = 0; index < total; index += 1) {
    const session = await createTerminalSession(rootPath, manifest, {
      activate: false,
      title: total > 1 ? `${baseTitle} #${index + 1}` : baseTitle,
      environment: groupEnvironmentRequest(mode, sessions[0]),
    });
    sessions.push(session);
  }
  const sessionIds = sessions.map((session) => session.id);
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds);
}
