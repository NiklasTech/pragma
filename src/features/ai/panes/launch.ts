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

/** One CLI of a group start, its account and how many of it run. */
export interface TeamLaunch {
  manifest: CLIManifest;
  accountDir?: string;
  count: number;
}

/// Starts `count` new terminals of one CLI one after another and shows exactly them in the grid.
export function launchTerminals(
  rootPath: string,
  manifest: CLIManifest,
  count: number,
  mode: GroupEnvironment,
  accountDir?: string,
  task?: GroupTask,
): Promise<void> {
  return launchTeam(rootPath, [{ manifest, accountDir, count }], mode, task);
}

/// Starts the terminals of several CLIs one after another and shows exactly them in the grid.
export async function launchTeam(
  rootPath: string,
  members: readonly TeamLaunch[],
  mode: GroupEnvironment,
  task?: GroupTask,
): Promise<void> {
  const starts = members
    .flatMap((member) =>
      Array.from({ length: Math.max(Math.round(member.count), 0) }, () => member),
    )
    .slice(0, MAX_PANES);
  if (starts.length === 0 && members[0]) starts.push(members[0]);
  const sessions: ChatSession[] = [];
  for (const [index, member] of starts.entries()) {
    const baseTitle = task?.title ?? terminalSessionTitle(member.manifest.name);
    const session = await createTerminalSession(rootPath, member.manifest, {
      activate: false,
      title: starts.length > 1 ? `${baseTitle} #${index + 1}` : baseTitle,
      environment: groupEnvironmentRequest(mode, sessions[0]),
      accountDir: member.accountDir,
    });
    sessions.push(session);
    if (task) deliverTerminalPrompt(session.id, task.prompt);
  }
  const sessionIds = sessions.map((session) => session.id);
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds);
}
