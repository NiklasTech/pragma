import { cliFolderLabel } from "@/features/ai/cli-folders/sources";

import { isPathInside } from "./folders";
import { newProjectFileId, projectAgentFileId, projectAgentId } from "./projectFile";
import { uniqueAgentName } from "./transfer";
import type { Agent, AgentEngine, AgentScope } from "./types";

export const SCOPE_LABELS: Record<AgentScope, string> = {
  personal: "Personal",
  project: "Project",
};

export function agentScope(agent: Pick<Agent, "scope">): AgentScope {
  return agent.scope ?? "personal";
}

/** The scope, or the CLI folder a discovered agent was read from. */
export function agentOriginLabel(agent: Pick<Agent, "scope" | "source">): string {
  return agent.source ? cliFolderLabel(agent.source) : SCOPE_LABELS[agentScope(agent)];
}

export function agentsInScope(agents: Agent[], scope: AgentScope): Agent[] {
  return agents.filter((agent) => agentScope(agent) === scope);
}

/** The engine without the base URL, which is machine specific and not allowed in project files. */
export function portableEngine(engine: AgentEngine): AgentEngine {
  const { baseUrl: _baseUrl, ...portable } = engine;
  return portable;
}

/** A new id for an agent in the scope; project ids follow the file name taken from the name. */
export function newAgentId(scope: AgentScope, name: string, agents: Agent[]): string {
  if (scope === "personal") return crypto.randomUUID();
  const taken = agentsInScope(agents, "project")
    .map((agent) => projectAgentFileId(agent.id))
    .filter((id): id is string => id !== null);
  return projectAgentId(newProjectFileId(name, taken));
}

/** Copies an agent into the other scope with a free name; a project copy keeps only workspace folders. */
export function copyAgentToScope(
  agent: Agent,
  scope: AgentScope,
  agents: Agent[],
  rootPath: string | null,
  now = Date.now(),
): { agent: Agent; droppedFolders: number } {
  const name = uniqueAgentName(agent.name, agentsInScope(agents, scope));
  const folders =
    scope === "project"
      ? agent.folders.filter((folder) => rootPath !== null && isPathInside(rootPath, folder))
      : agent.folders;

  const { source: _source, ...rest } = agent;
  const copy: Agent = {
    ...rest,
    id: newAgentId(scope, name, agents),
    name,
    engine: scope === "project" ? portableEngine(agent.engine) : agent.engine,
    folders,
    memory: agent.memory.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
    createdAt: now,
    updatedAt: now,
  };
  if (scope === "project") copy.scope = "project";
  else delete copy.scope;
  return { agent: copy, droppedFolders: agent.folders.length - folders.length };
}
