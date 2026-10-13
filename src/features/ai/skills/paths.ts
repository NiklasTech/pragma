import { isCliSkillPath } from "@/features/ai/cli-folders/sources";

export const SKILL_FILE_NAME = "SKILL.md";

export type SkillFormat = "legacy" | "standard";

export function skillsDir(rootPath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/.pragma/skills`;
}

/** A file below `.pragma/skills/` or a skill folder of a coding CLI. */
export function isSkillPath(path: string): boolean {
  return /(^|\/)\.pragma\/skills\//.test(path.replace(/\\/g, "/")) || isCliSkillPath(path);
}

/** `standard` for `<id>/SKILL.md`, `legacy` for the single file `<id>.md`. */
export function skillFormat(id: string, path: string): SkillFormat {
  return path.replace(/\\/g, "/").endsWith(`/${id}/${SKILL_FILE_NAME}`) ? "standard" : "legacy";
}
