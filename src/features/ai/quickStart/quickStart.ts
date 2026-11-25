import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";
import type { AgentView } from "@/shared/stores/settings";

import type { PresetNode, PresetPane } from "../panes/layoutPresets";

/** Who runs the task: a coding CLI by manifest id, or a plain terminal. */
export type QuickAgent =
  | { kind: "cli"; manifestId: string; accountDir?: string }
  | { kind: "terminal" };

export const TERMINAL_ONLY: QuickAgent = { kind: "terminal" };

/** Agents a number key picks, in manifest order; Terminal only has the key T. */
export const MAX_AGENT_KEYS = 9;

export interface QuickAgents {
  ready: CLIManifest[];
  missing: CLIManifest[];
}

/** Installed CLIs with a terminal, and the ones that still need installing. */
export function quickAgents(
  manifests: readonly CLIManifest[],
  statuses: Record<string, CLIStatus>,
): QuickAgents {
  const terminals = manifests.filter((manifest) => manifest.offers_terminal);
  return {
    ready: terminals.filter((manifest) => statuses[manifest.id]?.installed === true),
    missing: terminals.filter((manifest) => statuses[manifest.id]?.installed !== true),
  };
}

export function agentPane(agent: QuickAgent, view: AgentView = "terminal"): PresetPane {
  if (agent.kind === "terminal") return { type: "pane", start: "shell" };
  return {
    type: "pane",
    start: "cli",
    cliProviderId: agent.manifestId,
    ...(agent.accountDir ? { cliAccountDir: agent.accountDir } : {}),
    ...(view === "chat" ? { view } : {}),
  };
}

const SHELL: PresetPane = { type: "pane", start: "shell" };

export interface QuickLayout {
  id: string;
  name: string;
  build: (agent: PresetPane) => PresetNode;
}

export const QUICK_LAYOUTS: readonly QuickLayout[] = [
  { id: "agent", name: "Just the agent", build: (agent) => agent },
  {
    id: "agent-shells",
    name: "Agent, 2 terminals",
    build: (agent) => ({
      type: "split",
      direction: "horizontal",
      sizes: [58, 42],
      children: [
        agent,
        { type: "split", direction: "vertical", sizes: [50, 50], children: [SHELL, SHELL] },
      ],
    }),
  },
  {
    id: "pair",
    name: "Two agents, one task",
    build: (agent) => ({
      type: "split",
      direction: "horizontal",
      sizes: [50, 50],
      children: [agent, agent],
    }),
  },
];

function hasCli(node: PresetNode): boolean {
  return node.type === "pane" ? node.start === "cli" : node.children.some(hasCli);
}

/** A saved layout runs as saved; without a CLI, its first empty pane runs the chosen agent. */
export function withAgent(layout: PresetNode, agent: PresetPane): PresetNode {
  if (hasCli(layout)) return layout;
  let placed = false;
  const visit = (node: PresetNode): PresetNode => {
    if (node.type === "split") return { ...node, children: node.children.map(visit) };
    if (placed || node.start !== "empty") return node;
    placed = true;
    return agent;
  };
  return visit(layout);
}

const MAX_SLUG = 40;

/** The branch slug the backend derives from a task; shown before the worktree exists. */
export function taskSlug(task: string): string {
  let slug = "";
  for (const char of task) {
    if (/[A-Za-z0-9]/.test(char)) slug += char.toLowerCase();
    else if (slug !== "" && !slug.endsWith("-")) slug += "-";
    if (slug.length >= MAX_SLUG) break;
  }
  return slug.replace(/-+$/, "");
}

const TAB_WORDS = 4;

/** A short tab title from the first words of a task; without one, what the tab runs. */
export function taskTabTitle(task: string, runs = "Agent"): string {
  const words = task.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return runs;
  const title = words.slice(0, TAB_WORDS).join(" ");
  return words.length > TAB_WORDS ? `${title}…` : title;
}
