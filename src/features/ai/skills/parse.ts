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

function readFrontMatter(content: string): { fields: Map<string, string>; body: string } | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;
  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1)));
  }
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
  const fallback: Skill = { id, path, name: id, description: "", enabled: false, error: null };
  if (!isValidSkillId(id)) {
    return { ...fallback, error: "File name may only use letters, digits, - and _" };
  }

  const frontMatter = readFrontMatter(content);
  if (!frontMatter) return { ...fallback, error: "Missing front matter" };

  const { fields, body } = frontMatter;
  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
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
  return { ...skill, error: headingError(body) };
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
