import type { ChatSession, CLIManifest } from "@/shared/stores/ai";
import type { AgentView } from "@/shared/stores/settings";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab, findSpaceByFolder } from "@/shared/stores/spaces/model";

import { deliverTerminalPrompt } from "../children/terminalPrompt";
import { groupEnvironmentRequest, type GroupEnvironment } from "../sessions/group";
import { startSession, type StartSessionRequest } from "../sessions/start";
import { terminalSessionTitle } from "../terminal/title";
import { resolveAgentView } from "./agentView";
import { sendChatTasks, type ChatTask } from "./chatTasks";
import { MAX_PANES } from "./operations";
import { useAgentsPanesStore } from "./store";

export interface CreateCliSessionOptions {
  activate?: boolean;
  title?: string;
  environment?: Pick<StartSessionRequest, "environment" | "sameEnvironmentAs">;
  /** The CLI's account folder; unset runs its default account. */
  accountDir?: string;
}

/** A conversation with a coding CLI in Pragma's own chat. */
export function cliConversationInit(
  manifest: CLIManifest,
  accountDir?: string,
): StartSessionRequest["init"] {
  return {
    kind: "agent",
    cliProviderId: manifest.id,
    agentEngine: { kind: "cli", cliProviderId: manifest.id },
    ...(accountDir ? { cliAccountDir: accountDir } : {}),
  };
}

export function createConversationSession(
  rootPath: string,
  manifest: CLIManifest,
  options?: CreateCliSessionOptions,
): Promise<ChatSession> {
  return startSession(rootPath, {
    init: {
      ...cliConversationInit(manifest, options?.accountDir),
      ...(options?.title ? { title: options.title } : {}),
    },
    ...options?.environment,
    activate: options?.activate,
  });
}

/** Starts a CLI in the wanted view, or in the only one it has. */
export function createAgentSession(
  rootPath: string,
  manifest: CLIManifest,
  view: AgentView,
  options?: CreateCliSessionOptions,
): Promise<ChatSession> {
  return resolveAgentView(manifest, view) === "chat"
    ? createConversationSession(rootPath, manifest, options)
    : createTerminalSession(rootPath, manifest, options);
}

export function createTerminalSession(
  rootPath: string,
  manifest: CLIManifest,
  options?: CreateCliSessionOptions,
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

/** One agent of a start: its CLI, its account and, when it has one, its own task. */
export interface TerminalStart {
  manifest: CLIManifest;
  accountDir?: string;
  task?: GroupTask;
}

/// Starts the terminals of several CLIs one after another and shows exactly them in the grid.
export function launchTeam(
  rootPath: string,
  members: readonly TeamLaunch[],
  mode: GroupEnvironment,
  task?: GroupTask,
): Promise<void> {
  const starts = members.flatMap((member) =>
    Array.from({ length: Math.max(Math.round(member.count), 0) }, () => ({
      manifest: member.manifest,
      accountDir: member.accountDir,
      task,
    })),
  );
  if (starts.length === 0 && members[0]) {
    starts.push({ manifest: members[0].manifest, accountDir: members[0].accountDir, task });
  }
  return launchStarts(rootPath, starts, mode);
}

/// Starts each agent with its own task, one after another, and shows exactly them in the grid.
export async function launchStarts(
  rootPath: string,
  requested: readonly TerminalStart[],
  mode: GroupEnvironment,
  view: AgentView = "terminal",
): Promise<void> {
  const starts = requested.slice(0, MAX_PANES);
  // Starts take a while in worktrees; the grid belongs to the tab the start came from.
  const startTab = frontAgentsTab(rootPath);
  const titles = teamTitles(
    starts.map((start) => start.task?.title ?? terminalSessionTitle(start.manifest.name)),
  );
  const sessions: ChatSession[] = [];
  const chatTasks: ChatTask[] = [];
  for (const [index, start] of starts.entries()) {
    const session = await createAgentSession(rootPath, start.manifest, view, {
      activate: false,
      title: titles[index],
      environment: groupEnvironmentRequest(mode, sessions[0]),
      accountDir: start.accountDir,
    });
    sessions.push(session);
    if (!start.task) continue;
    if (resolveAgentView(start.manifest, view) === "chat") {
      chatTasks.push({ sessionId: session.id, prompt: start.task.prompt });
    } else deliverTerminalPrompt(session.id, start.task.prompt);
  }
  const sessionIds = sessions.map((session) => session.id);
  const target = startTab && tabStillOpen(rootPath, startTab) ? startTab : undefined;
  useAgentsPanesStore.getState().replaceLayout(rootPath, sessionIds, target);
  await sendChatTasks(rootPath, chatTasks);
}
