import { Document, parse as parseYaml, visit } from "yaml";

import { FRONT_MATTER_PATTERN, isValidSkillId } from "@/features/ai/skills/parse";

import { isPathInside, normalizePath, resolveAgentPath } from "./folders";
import { isProvider } from "./transfer";
import type { Agent, AgentEngine } from "./types";
import { AGENT_BRIEF_MAX, AGENT_NAME_MAX } from "./validation";

export const PROJECT_AGENT_ID_PREFIX = "project:";

const FILE_ID_MAX = 64;
const SECRET_TOKEN =
  /(?:^|[^A-Za-z0-9_-])(?:sk-|ghp_|github_pat_|xai-)[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}/;

export interface ProjectAgentIssue {
  id: string;
  path: string;
  name: string;
  error: string;
}

export type ProjectAgentParse =
  | { ok: true; agent: Agent }
  | { ok: false; issue: ProjectAgentIssue };

export function agentsDir(rootPath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/.pragma/agents`;
}

export function projectAgentPath(rootPath: string, fileId: string): string {
  return `${agentsDir(rootPath)}/${fileId}.md`;
}

export function isProjectAgentPath(path: string): boolean {
  return /(^|\/)\.pragma\/agents\/[^/]+\.md$/.test(path.replace(/\\/g, "/"));
}

export function projectAgentId(fileId: string): string {
  return `${PROJECT_AGENT_ID_PREFIX}${fileId}`;
}

export function projectAgentFileId(agentId: string): string | null {
  return agentId.startsWith(PROJECT_AGENT_ID_PREFIX)
    ? agentId.slice(PROJECT_AGENT_ID_PREFIX.length)
    : null;
}

/** A file id derived from the name that no other project agent uses. */
export function newProjectFileId(name: string, takenIds: string[]): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, FILE_ID_MAX - 4) || "agent";
  const taken = new Set(takenIds);
  if (!taken.has(slug)) return slug;
  for (let index = 2; ; index++) {
    const candidate = `${slug}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function containsSecretToken(text: string): boolean {
  return SECRET_TOKEN.test(text);
}

function folderError(folder: string): string | null {
  const trimmed = folder.trim();
  if (!trimmed || /^([a-zA-Z]:[\\/]|\\\\|\/|~)/.test(trimmed)) {
    return `Folder ${folder} must be relative to the workspace`;
  }
  let depth = 0;
  for (const part of trimmed.split(/[\\/]/)) {
    if (part === "..") depth -= 1;
    else if (part !== "" && part !== ".") depth += 1;
    if (depth < 0) return `Folder ${folder} leaves the workspace`;
  }
  return null;
}

/** Splits approved folders into paths relative to the workspace and folders outside it. */
export function relativeAgentFolders(
  rootPath: string,
  folders: string[],
): { relative: string[]; outside: string[] } {
  const root = normalizePath(rootPath);
  const relative: string[] = [];
  const outside: string[] = [];
  for (const folder of folders) {
    const path = normalizePath(folder);
    if (path === root) continue;
    if (isPathInside(root, path)) relative.push(path.slice(root.length + 1));
    else outside.push(folder);
  }
  return { relative, outside };
}

type Field<T> = { ok: true; value: T | undefined } | { ok: false };

function readText(fields: Record<string, unknown>, key: string): Field<string> {
  const value = fields[key];
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return typeof value === "string" ? { ok: true, value: value.trim() } : { ok: false };
}

function readList(fields: Record<string, unknown>, key: string): Field<string[]> {
  const value = fields[key];
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return { ok: false };
  }
  return { ok: true, value };
}

function readEngine(fields: Record<string, unknown>): AgentEngine | string {
  if (fields.baseUrl !== undefined) return "baseUrl is not allowed in project agents";
  const kind = fields.engine;
  if (kind === "cli") {
    const cli = readText(fields, "cli");
    if (!cli.ok || !cli.value) return "cli is required when engine is cli";
    return { kind: "cli", cliProviderId: cli.value };
  }
  if (kind !== "builtin") return "engine must be builtin or cli";

  const engine: AgentEngine = { kind: "builtin" };
  const provider = readText(fields, "provider");
  if (!provider.ok || (provider.value !== undefined && !isProvider(provider.value))) {
    return "provider is not a known provider";
  }
  if (provider.value !== undefined) engine.provider = provider.value;
  const model = readText(fields, "model");
  if (!model.ok) return "model must be text";
  if (model.value) engine.model = model.value;
  return engine;
}

function readFields(block: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = parseYaml(block);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Builds a project agent from `.pragma/agents/<fileId>.md`; folders resolve against the workspace. */
export function parseProjectAgent(
  fileId: string,
  path: string,
  content: string,
  rootPath: string,
  now = Date.now(),
): ProjectAgentParse {
  let displayName = fileId;
  const fail = (error: string): ProjectAgentParse => ({
    ok: false,
    issue: { id: projectAgentId(fileId), path, name: displayName, error },
  });
  if (!isValidSkillId(fileId)) return fail("File name may only use letters, digits, - and _");

  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return fail("Missing front matter");
  const fields = readFields(match[1]);
  if (!fields) return fail("Front matter is not valid YAML");

  const name = readText(fields, "name");
  if (!name.ok || !name.value) return fail("Missing name");
  displayName = name.value;
  if (name.value.length > AGENT_NAME_MAX) {
    return fail(`Name must be ${AGENT_NAME_MAX} characters or fewer`);
  }

  const brief = content.slice(match[0].length).trim();
  if (!brief) return fail("Missing brief below the front matter");
  if (brief.length > AGENT_BRIEF_MAX) {
    return fail(`Brief must be ${AGENT_BRIEF_MAX} characters or fewer`);
  }
  if (containsSecretToken(content)) return fail("Do not store secrets in agent files");

  const description = readText(fields, "description");
  if (!description.ok) return fail("description must be text");
  const engine = readEngine(fields);
  if (typeof engine === "string") return fail(engine);

  const skills = readList(fields, "skills");
  if (!skills.ok || !(skills.value ?? []).every(isValidSkillId)) {
    return fail("skills must be a list of skill ids");
  }
  const mcpServers = readList(fields, "mcpServers");
  if (!mcpServers.ok) return fail("mcpServers must be a list of server ids");
  const folders = readList(fields, "folders");
  if (!folders.ok) return fail("folders must be a list of paths");
  for (const folder of folders.value ?? []) {
    const error = folderError(folder);
    if (error) return fail(error);
  }

  const agent: Agent = {
    id: projectAgentId(fileId),
    name: name.value,
    brief,
    engine,
    folders: (folders.value ?? []).map((folder) => resolveAgentPath(rootPath, folder)),
    memory: [],
    skills: skills.value ?? [],
    scope: "project",
    createdAt: now,
    updatedAt: now,
  };
  if (description.value) agent.description = description.value;
  if (mcpServers.value) agent.mcpServers = mcpServers.value;
  return { ok: true, agent };
}

/** The Markdown file of an agent; `folders` are relative to the workspace, the base URL is left out. */
export function serializeProjectAgent(agent: Agent, folders: string[]): string {
  const fields: Record<string, unknown> = { name: agent.name };
  if (agent.description) fields.description = agent.description;
  fields.engine = agent.engine.kind;
  if (agent.engine.kind === "cli") {
    if (agent.engine.cliProviderId) fields.cli = agent.engine.cliProviderId;
  } else {
    if (agent.engine.provider) fields.provider = agent.engine.provider;
    if (agent.engine.model) fields.model = agent.engine.model;
  }
  if (agent.skills.length > 0) fields.skills = agent.skills;
  if (agent.mcpServers) fields.mcpServers = agent.mcpServers;
  if (folders.length > 0) fields.folders = folders;

  const doc = new Document(fields);
  visit(doc, {
    Seq(_, node) {
      node.flow = true;
    },
  });
  return `---\n${doc.toString({ lineWidth: 0 })}---\n\n${agent.brief.trim()}\n`;
}
