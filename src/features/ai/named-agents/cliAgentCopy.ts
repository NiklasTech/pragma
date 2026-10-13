import { isValidSkillId } from "@/features/ai/skills/parse";

import { cliAgentFileId } from "./cliAgentFile";
import { newProjectFileId, projectAgentFileId, projectAgentId } from "./projectFile";
import { agentsInScope } from "./scope";
import { uniqueAgentName } from "./transfer";
import type { Agent } from "./types";

/** A `.pragma/agents` agent made from a discovered one; it keeps the file id when it can. */
export function cliAgentToPragma(agent: Agent, agents: Agent[], now = Date.now()): Agent {
  const others = agentsInScope(agents, "project").filter((item) => item.id !== agent.id);
  const name = uniqueAgentName(agent.name, others);
  const taken = others
    .map((item) => projectAgentFileId(item.id))
    .filter((id): id is string => id !== null);
  const fileId = cliAgentFileId(agent.id);
  const keepFileId = fileId !== null && isValidSkillId(fileId) && !taken.includes(fileId);

  const { source: _source, ...rest } = agent;
  return {
    ...rest,
    id: projectAgentId(keepFileId ? fileId : newProjectFileId(name, taken)),
    name,
    memory: agent.memory.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
    scope: "project",
    createdAt: now,
    updatedAt: now,
  };
}
