import { parse as parseYaml } from "yaml";

import { FRONT_MATTER_PATTERN } from "@/features/ai/skills/parse";

import { readMarkdown } from "./cliAgentFile";
import { containsSecretToken, parseProjectAgent } from "./projectFile";
import { type Parsed, uniqueAgentName } from "./transfer";
import type { Agent, AgentEngine } from "./types";
import { AGENT_BRIEF_MAX, AGENT_NAME_MAX, isAgentBriefValid, isAgentNameValid } from "./validation";

function namesEngine(text: string): boolean {
  const match = FRONT_MATTER_PATTERN.exec(text);
  if (!match) return false;
  try {
    const fields: unknown = parseYaml(match[1]);
    return typeof fields === "object" && fields !== null && "engine" in fields;
  } catch {
    return false;
  }
}

/** The agent name a file without one gets: its file name without `.agent.md` or `.md`. */
function nameFromFile(fileName: string): string {
  return fileName.replace(/(\.agent)?\.md$/i, "").trim();
}

function fromPragmaFile(text: string, fileName: string, agents: Agent[], now: number): Parsed {
  const parsed = parseProjectAgent("import", fileName, text, "", now);
  if (!parsed.ok) return { ok: false, error: parsed.issue.error };
  const { scope: _scope, ...agent } = parsed.agent;
  // Folder access is granted on this machine only; a file must not widen it.
  return {
    ok: true,
    agent: {
      ...agent,
      id: crypto.randomUUID(),
      name: uniqueAgentName(agent.name, agents),
      folders: [],
    },
    droppedFolders: agent.folders.length,
  };
}

function fromCliFile(
  text: string,
  fileName: string,
  agents: Agent[],
  engine: AgentEngine,
  now: number,
): Parsed {
  const fields = readMarkdown(text);
  if (typeof fields === "string") return { ok: false, error: fields };
  if (fields.name !== undefined && fields.name !== null && typeof fields.name !== "string") {
    return { ok: false, error: "The agent name must be text" };
  }
  const name =
    (typeof fields.name === "string" ? fields.name.trim() : "") || nameFromFile(fileName);
  if (!isAgentNameValid(name)) {
    return { ok: false, error: `The agent name must be 1 to ${AGENT_NAME_MAX} characters` };
  }
  if (!isAgentBriefValid(fields.brief)) {
    return {
      ok: false,
      error: `The instructions below the front matter must be 1 to ${AGENT_BRIEF_MAX} characters`,
    };
  }

  const agent: Agent = {
    id: crypto.randomUUID(),
    name: uniqueAgentName(name, agents),
    brief: fields.brief,
    engine,
    folders: [],
    memory: [],
    skills: [],
    createdAt: now,
    updatedAt: now,
  };
  if (typeof fields.description === "string" && fields.description.trim()) {
    agent.description = fields.description.trim().replace(/\s*\n\s*/g, " ");
  }
  return { ok: true, agent, droppedFolders: 0 };
}

/**
 * Builds a personal agent from a Markdown file: the `.pragma/agents` format when the front matter
 * names an engine, otherwise a coding CLI subagent that runs on `engine`.
 */
export function parseAgentMarkdown(
  text: string,
  fileName: string,
  agents: Agent[],
  engine: AgentEngine,
  now = Date.now(),
): Parsed {
  if (containsSecretToken(text)) {
    return { ok: false, error: "The file contains something that looks like a secret" };
  }
  return namesEngine(text)
    ? fromPragmaFile(text, fileName, agents, now)
    : fromCliFile(text, fileName, agents, engine, now);
}
