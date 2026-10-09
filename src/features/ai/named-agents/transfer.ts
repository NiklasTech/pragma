import type { Agent, AgentEngine, AgentMemoryEntry } from "./types";
import {
  AGENT_NAME_MAX,
  isAgentBriefValid,
  isAgentNameUnique,
  isAgentNameValid,
  validateMemoryEntry,
} from "./validation";

export const AGENT_FILE_FORMAT = "pragma-agent";
export const AGENT_FILE_VERSION = 1;

const SKILL_ID = /^[A-Za-z0-9_-]{1,64}$/;

interface AgentFile {
  format: typeof AGENT_FILE_FORMAT;
  version: typeof AGENT_FILE_VERSION;
  agent: {
    name: string;
    brief: string;
    engine: AgentEngine;
    skills: string[];
    folders: string[];
    mcpServers?: string[];
    memory?: Array<Pick<AgentMemoryEntry, "text" | "source">>;
  };
}

/// The shareable part of an agent; memory only when asked, ids and timestamps never.
export function serializeAgent(agent: Agent, includeMemory: boolean): string {
  const file: AgentFile = {
    format: AGENT_FILE_FORMAT,
    version: AGENT_FILE_VERSION,
    agent: {
      name: agent.name,
      brief: agent.brief,
      engine: agent.engine,
      skills: agent.skills,
      folders: agent.folders,
    },
  };
  if (agent.mcpServers) file.agent.mcpServers = agent.mcpServers;
  if (includeMemory) {
    file.agent.memory = agent.memory.map((entry) => ({ text: entry.text, source: entry.source }));
  }
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function agentFileName(agent: Pick<Agent, "name">): string {
  const slug = agent.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "agent"}.agent.json`;
}

type Parsed = { ok: true; agent: Agent } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined | null {
  const value = record[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : null;
}

function parseEngine(value: unknown): AgentEngine | null {
  if (!isRecord(value) || (value.kind !== "builtin" && value.kind !== "cli")) return null;
  const engine: AgentEngine = { kind: value.kind };
  for (const key of ["provider", "model", "baseUrl", "cliProviderId"] as const) {
    const field = optionalString(value, key);
    if (field === null) return null;
    if (field !== undefined) Object.assign(engine, { [key]: field });
  }
  return engine;
}

/// A free name: the imported one, or the same with a number when it is taken.
export function uniqueAgentName(name: string, agents: Agent[]): string {
  if (isAgentNameUnique(name, agents)) return name;
  for (let index = 2; ; index++) {
    const suffix = ` ${index}`;
    const candidate = `${name.slice(0, AGENT_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (isAgentNameUnique(candidate, agents)) return candidate;
  }
}

/// Validates an exported agent file and builds a new agent from it.
export function parseAgentFile(text: string, agents: Agent[], now = Date.now()): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON" };
  }
  if (!isRecord(data) || data.format !== AGENT_FILE_FORMAT || !isRecord(data.agent)) {
    return { ok: false, error: "The file is not a Pragma agent" };
  }
  if (data.version !== AGENT_FILE_VERSION) {
    return { ok: false, error: "This agent file version is not supported" };
  }

  const source = data.agent;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const brief = typeof source.brief === "string" ? source.brief.trim() : "";
  if (!isAgentNameValid(name)) return { ok: false, error: "The agent name is missing or too long" };
  if (!isAgentBriefValid(brief))
    return { ok: false, error: "The agent brief is missing or too long" };

  const engine = parseEngine(source.engine);
  if (!engine) return { ok: false, error: "The agent engine is invalid" };

  const skills = stringArray(source.skills);
  if (!skills || !skills.every((id) => SKILL_ID.test(id))) {
    return { ok: false, error: "The agent skills are invalid" };
  }
  const folders = stringArray(source.folders);
  if (!folders) return { ok: false, error: "The agent folders are invalid" };
  const mcpServers = source.mcpServers === undefined ? undefined : stringArray(source.mcpServers);
  if (mcpServers === null) return { ok: false, error: "The agent MCP servers are invalid" };

  const memory: AgentMemoryEntry[] = [];
  if (source.memory !== undefined) {
    if (!Array.isArray(source.memory)) return { ok: false, error: "The agent memory is invalid" };
    for (const entry of source.memory) {
      if (!isRecord(entry) || typeof entry.text !== "string") {
        return { ok: false, error: "The agent memory is invalid" };
      }
      const failure = validateMemoryEntry(entry.text, memory);
      if (failure) return { ok: false, error: failure };
      memory.push({
        id: crypto.randomUUID(),
        text: entry.text,
        createdAt: now,
        source: entry.source === "agent" ? "agent" : "user",
      });
    }
  }

  const agent: Agent = {
    id: crypto.randomUUID(),
    name: uniqueAgentName(name, agents),
    brief,
    engine,
    folders,
    memory,
    skills,
    createdAt: now,
    updatedAt: now,
  };
  if (mcpServers) agent.mcpServers = mcpServers;
  return { ok: true, agent };
}
