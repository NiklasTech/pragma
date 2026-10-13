import { stringify as stringifyToml } from "smol-toml";
import { Document } from "yaml";

import type { Agent } from "@/features/ai/named-agents/types";
import { FRONT_MATTER_PATTERN } from "@/features/ai/skills/parse";
import { skillFormat } from "@/features/ai/skills/paths";
import type { Skill } from "@/features/ai/skills/types";
import type { AIProvider } from "@/shared/stores/ai";

import type { CliSyncTargetId } from "./targets";

/** The provider whose model ids a target's agent files accept. */
const MODEL_PROVIDERS: Partial<Record<CliSyncTargetId, AIProvider>> = {
  claude: "anthropic",
  codex: "openai",
  gemini: "gemini",
};

function frontMatter(fields: Record<string, string>): string {
  return `---\n${new Document(fields).toString({ lineWidth: 0 })}---\n`;
}

/** A skill as `SKILL.md`; legacy front matter is rebuilt as YAML and `enabled` is left out. */
export function syncedSkillContent(skill: Skill, content: string): string | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;
  const body = content.slice(match[0].length);
  if (skillFormat(skill.id, skill.path) === "legacy") {
    return `${frontMatter({ name: skill.name, description: skill.description })}${body}`;
  }
  const lines = match[1].split(/\r?\n/).filter((line) => !/^enabled\s*:/.test(line));
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

function agentModel(target: CliSyncTargetId, agent: Agent): string | undefined {
  const { engine } = agent;
  if (engine.kind !== "builtin" || !engine.model) return undefined;
  return engine.provider === MODEL_PROVIDERS[target] ? engine.model : undefined;
}

/**
 * An agent in a target's format. `name` is the file id, which every CLI accepts as an
 * identifier; the model is kept only when the agent uses that CLI's provider.
 */
export function syncedAgentContent(
  target: CliSyncTargetId,
  format: "markdown" | "toml",
  fileId: string,
  agent: Agent,
): string {
  const fields: Record<string, string> = {
    name: fileId,
    description: agent.description || agent.name,
  };
  const model = agentModel(target, agent);
  if (model) fields.model = model;
  const brief = agent.brief.trim();
  if (format === "toml") {
    return `${stringifyToml({ ...fields, developer_instructions: brief })}\n`;
  }
  return `${frontMatter(fields)}\n${brief}\n`;
}
