import type { CLIManifest } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import type { AgentView } from "@/shared/stores/settings";
import { findSpaceByFolder } from "@/shared/stores/spaces/model";

import { launchStarts, type TerminalStart } from "../panes/launch";
import type { QuickWhere } from "./startQuickTask";

export const AGENT_COUNTS = ["1", "2", "3", "4", "6", "8"] as const;
export type AgentCount = (typeof AGENT_COUNTS)[number];

export interface SeveralAgentsRequest {
  rootPath: string;
  task: string;
  tabTitle: string;
  manifest: CLIManifest;
  accountDir?: string;
  count: number;
  where: QuickWhere;
  view: AgentView;
}

/** The starts of one agent, several times; each gets the task when there is one. */
export function severalStarts(
  manifest: CLIManifest,
  count: number,
  task: string,
  accountDir?: string,
): TerminalStart[] {
  const prompt = task.trim();
  return Array.from({ length: count }, () => ({
    manifest,
    accountDir,
    ...(prompt ? { task: { title: manifest.name, prompt } } : {}),
  }));
}

/** Starts the same agent several times side by side in a new tab; a worktree start gives each its own. */
export async function startSeveralAgents(request: SeveralAgentsRequest): Promise<void> {
  const repositories = useOpenRepositoriesStore.getState();
  const space = findSpaceByFolder(repositories.spaces, request.rootPath);
  if (!space) return;
  // The new tab is in front, so the agents' grid goes into it.
  repositories.addTab(space.id, request.tabTitle, "agents");
  await launchStarts(
    request.rootPath,
    severalStarts(request.manifest, request.count, request.task, request.accountDir),
    request.where === "worktree" ? "isolated" : "checkout",
    request.view,
  );
}
