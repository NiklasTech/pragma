import { parse as parseYaml } from "yaml";

import { skillFormat } from "./paths";
import type { Skill } from "./types";

export const SKILL_HEADINGS = ["Steps", "Check", "Needs approval"] as const;

const SKILL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function isValidSkillId(id: string): boolean {
  return SKILL_ID_PATTERN.test(id);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readYaml(block: string): Map<string, string> | null {
  let value: unknown;
  try {
    value = parseYaml(block);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const fields = new Map<string, string>();
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === "string") fields.set(key, field.trim());
    else if (typeof field === "number" || typeof field === "boolean")
      fields.set(key, String(field));
  }
  return fields;
}

function readLines(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1)));
  }
  return fields;
}

// SKILL.md front matter is YAML; legacy files keep the line reader so their values parse as before.
function readFrontMatter(
  content: string,
  yaml: boolean,
): { fields: Map<string, string>; body: string } | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;
  const fields = (yaml ? readYaml(match[1]) : null) ?? readLines(match[1]);
  return { fields, body: content.slice(match[0].length) };
}

function headingError(body: string): string | null {
  const headings = body
    .split(/\r?\n/)
    .map((line) => /^##\s+(.+?)\s*#*\s*$/.exec(line)?.[1] ?? null)
    .filter((heading): heading is string => heading !== null);

  const positions = SKILL_HEADINGS.map((heading) => headings.indexOf(heading));
  const missing = SKILL_HEADINGS.find((_, index) => positions[index] === -1);
  if (missing) return `Missing ## ${missing} heading`;

  const ordered = positions.every(
    (position, index) => index === 0 || position > positions[index - 1],
  );
  if (!ordered)
    return `Headings must be in order: ${SKILL_HEADINGS.map((h) => `## ${h}`).join(", ")}`;
  return null;
}

export function parseSkill(id: string, path: string, content: string): Skill {
  const format = skillFormat(id, path);
  const fallback: Skill = { id, path, name: id, description: "", enabled: false, error: null };
  if (!isValidSkillId(id)) {
    const subject = format === "standard" ? "Folder name" : "File name";
    return { ...fallback, error: `${subject} may only use letters, digits, - and _` };
  }

  const frontMatter = readFrontMatter(content, format === "standard");
  if (!frontMatter) return { ...fallback, error: "Missing front matter" };

  const { fields, body } = frontMatter;
  const name = fields.get("name") ?? "";
  const description = (fields.get("description") ?? "").replace(/\s*\n\s*/g, " ");
  const enabledValue = fields.get("enabled");
  const skill: Skill = {
    ...fallback,
    name: name || id,
    description,
    enabled: enabledValue !== "false",
  };

  if (!name) return { ...skill, error: "Missing name" };
  if (!description) return { ...skill, error: "Missing description" };
  if (enabledValue !== undefined && enabledValue !== "true" && enabledValue !== "false") {
    return { ...skill, error: "enabled must be true or false" };
  }
  return { ...skill, error: format === "legacy" ? headingError(body) : null };
}

export function setSkillEnabled(content: string, enabled: boolean): string | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = match[1].split(/\r?\n/).filter((line) => !/^enabled\s*:/.test(line));
  lines.push(`enabled: ${enabled}`);
  return `---${newline}${lines.join(newline)}${newline}---${newline}${content.slice(match[0].length)}`;
}

export function buildSkillTemplate(name: string): string {
  return [
    "---",
    `name: ${name}`,
    "description: One sentence that says when this skill applies.",
    "---",
    "",
    "## Steps",
    "",
    "1. ",
    "",
    "## Check",
    "",
    "- ",
    "",
    "## Needs approval",
    "",
    "- ",
    "",
  ].join("\n");
}
