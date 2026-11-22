import type { ChatSession, CLIManifest } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab, findSpaceByFolder } from "@/shared/stores/spaces/model";

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

/** The agents tab of the folder's space that is in front right now. */
function frontAgentsTab(rootPath: string): string | undefined {
  const space = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  const tab = space ? activeTab(space) : undefined;
  return tab?.kind === "agents" ? tab.id : undefined;
}

function tabStillOpen(rootPath: string, tabId: string): boolean {
  const space = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  return space?.tabs.some((tab) => tab.id === tabId) ?? false;
}

/** Numbers titles that repeat, counting each title on its own: "Codex #1", "Codex #2", "Gemini". */
export function teamTitles(baseTitles: readonly string[]): string[] {
  const totals = new Map<string, number>();
  for (const title of baseTitles) totals.set(title, (totals.get(title) ?? 0) + 1);
  const seen = new Map<string, number>();
  return baseTitles.map((title) => {
    if ((totals.get(title) ?? 0) < 2) return title;
    const number = (seen.get(title) ?? 0) + 1;
    seen.set(title, number);
    return `${title} #${number}`;
  });
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
  // Starts take a while in worktrees; the grid belongs to the tab the start came from.
  const startTab = frontAgentsTab(rootPath);
  const titles = teamTitles(
    starts.map((member) => task?.title ?? terminalSessionTitle(member.manifest.name)),
  );
  const sessions: ChatSession[] = [];
  for (const [index, member] of starts.entries()) {
    const session = await createTerminalSession(rootPath, member.manifest, {
      activate: false,
      title: titles[index],
      environment: groupEnvironmentRequest(mode, sessions[0]),
      accountDir: member.accountDir,
    });
    sessions.push(session);
    if (task) deliverTerminalPrompt(session.id, task.prompt);
  }
  const sessionIds = sessions.map((session) => session.id);
  const target = startTab && tabStillOpen(rootPath, startTab) ? startTab : undefined;
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds, target);
}
