import { useAIStore, type ChatSession, type CLIManifest } from "@/shared/stores/ai";

import { terminalSessionTitle } from "../terminal/title";
import { MAX_PANES } from "./operations";
import { useAgentsPanesStore } from "./store";

export function createTerminalSession(
  rootPath: string,
  manifest: CLIManifest,
  options?: { activate?: boolean; title?: string },
): Promise<ChatSession> {
  return useAIStore.getState().createChatSession(
    rootPath,
    {
      kind: "terminal",
      environment: "checkout",
      cliProviderId: manifest.id,
      title: options?.title ?? terminalSessionTitle(manifest.name),
    },
    { activate: options?.activate },
  );
}

/// Starts `count` new terminals of one CLI and shows exactly them in the grid.
export async function launchTerminals(
  rootPath: string,
  manifest: CLIManifest,
  count: number,
): Promise<void> {
  const total = Math.min(Math.max(Math.round(count), 1), MAX_PANES);
  const baseTitle = terminalSessionTitle(manifest.name);
  const sessionIds: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const session = await createTerminalSession(rootPath, manifest, {
      activate: false,
      title: total > 1 ? `${baseTitle} #${index + 1}` : baseTitle,
    });
    sessionIds.push(session.id);
  }
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds);
}
