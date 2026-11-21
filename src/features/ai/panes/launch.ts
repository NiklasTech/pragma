import type { ChatSession, CLIManifest } from "@/shared/stores/ai";

import { deliverTerminalPrompt } from "../children/terminalPrompt";
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
    /** The CLI's account folder; unset runs its default account. */
    accountDir?: string;
  },
): Promise<ChatSession> {
  return startSession(rootPath, {
    init: {
      kind: "terminal",
      cliProviderId: manifest.id,
      ...(options?.accountDir ? { cliAccountDir: options.accountDir } : {}),
      title: options?.title ?? terminalSessionTitle(manifest.name),
    },
    ...options?.environment,
    activate: options?.activate,
  });
}

/** What every terminal of a group works on: its title and the prompt typed into it. */
export interface GroupTask {
  title: string;
  prompt: string;
}

/// Starts `count` new terminals of one CLI one after another and shows exactly them in the grid.
export async function launchTerminals(
  rootPath: string,
  manifest: CLIManifest,
  count: number,
  mode: GroupEnvironment,
  accountDir?: string,
  task?: GroupTask,
): Promise<void> {
  const total = Math.min(Math.max(Math.round(count), 1), MAX_PANES);
  const baseTitle = task?.title ?? terminalSessionTitle(manifest.name);
  const sessions: ChatSession[] = [];
  for (let index = 0; index < total; index += 1) {
    const session = await createTerminalSession(rootPath, manifest, {
      activate: false,
      title: total > 1 ? `${baseTitle} #${index + 1}` : baseTitle,
      environment: groupEnvironmentRequest(mode, sessions[0]),
      accountDir,
    });
    sessions.push(session);
    if (task) deliverTerminalPrompt(session.id, task.prompt);
  }
  const sessionIds = sessions.map((session) => session.id);
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds);
}
