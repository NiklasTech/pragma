import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

import type { CliAgentFolder } from "@/features/ai/cli-folders/sources";
import { FRONT_MATTER_PATTERN } from "@/features/ai/skills/parse";

import type { ProjectAgentIssue, ProjectAgentParse } from "./projectFile";
import type { Agent } from "./types";
import { AGENT_BRIEF_MAX, AGENT_NAME_MAX } from "./validation";

export const CLI_AGENT_ID_PREFIX = "cli:";

export function cliAgentId(folderId: string, fileId: string): string {
  return `${CLI_AGENT_ID_PREFIX}${folderId}:${fileId}`;
}

/** The file id of a discovered agent, or null for any other agent. */
export function cliAgentFileId(agentId: string): string | null {
  if (!agentId.startsWith(CLI_AGENT_ID_PREFIX)) return null;
  const rest = agentId.slice(CLI_AGENT_ID_PREFIX.length);
  const separator = rest.indexOf(":");
  return separator > 0 ? rest.slice(separator + 1) : null;
}

/** The id of an agent file in the folder, or null when its ending does not belong to the folder. */
export function cliAgentFileIdFromName(folder: CliAgentFolder, fileName: string): string | null {
  const extension = folder.extensions.find((ending) => fileName.endsWith(ending));
  if (!extension) return null;
  const fileId = fileName.slice(0, -extension.length);
  return fileId ? fileId : null;
}

interface CliAgentFields {
  name: unknown;
  description: unknown;
  brief: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readMarkdown(content: string): CliAgentFields | string {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return { name: undefined, description: undefined, brief: content.trim() };
  let fields: unknown;
  try {
    fields = parseYaml(match[1]) ?? {};
  } catch {
    return "Front matter is not valid YAML";
  }
  if (!isRecord(fields)) return "Front matter is not valid YAML";
  return {
    name: fields.name,
    description: fields.description,
    brief: content.slice(match[0].length).trim(),
  };
}

function readToml(content: string): CliAgentFields | string {
  let fields: Record<string, unknown>;
  try {
    fields = parseToml(content);
  } catch {
    return "File is not valid TOML";
  }
  const instructions = fields.developer_instructions;
  return {
    name: fields.name,
    description: fields.description,
    brief: typeof instructions === "string" ? instructions.trim() : "",
  };
}

/**
 * Builds a read-only agent from a coding CLI agent file. `name`, `description` and the
 * instructions are used; tool-specific fields such as `tools` or `model` are ignored.
 */
export function parseCliAgent(
  folder: CliAgentFolder,
  fileId: string,
  path: string,
  content: string,
  now = Date.now(),
): ProjectAgentParse {
  const id = cliAgentId(folder.id, fileId);
  let displayName = fileId;
  const fail = (error: string): ProjectAgentParse => {
    const issue: ProjectAgentIssue = { id, path, name: displayName, error };
    return { ok: false, issue };
  };

  const fields = folder.format === "toml" ? readToml(content) : readMarkdown(content);
  if (typeof fields === "string") return fail(fields);

  if (fields.name !== undefined && fields.name !== null && typeof fields.name !== "string") {
    return fail("name must be text");
  }
  const name = (typeof fields.name === "string" ? fields.name.trim() : "") || fileId;
  displayName = name;
  if (name.length > AGENT_NAME_MAX)
    return fail(`Name must be ${AGENT_NAME_MAX} characters or fewer`);

  if (!fields.brief) {
    return fail(
      folder.format === "toml"
        ? "Missing developer_instructions"
        : "Missing instructions below the front matter",
    );
  }
  if (fields.brief.length > AGENT_BRIEF_MAX) {
    return fail(`Instructions must be ${AGENT_BRIEF_MAX} characters or fewer`);
  }

  const agent: Agent = {
    id,
    name,
    brief: fields.brief,
    engine: { kind: "cli", cliProviderId: folder.cliProviderId },
    folders: [],
    memory: [],
    skills: [],
    scope: "project",
    source: folder.id,
    createdAt: now,
    updatedAt: now,
  };
  if (typeof fields.description === "string" && fields.description.trim()) {
    agent.description = fields.description.trim().replace(/\s*\n\s*/g, " ");
  }
  return { ok: true, agent };
}
