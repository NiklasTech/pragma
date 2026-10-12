export const SKILL_FILE_NAME = "SKILL.md";

export type SkillFormat = "legacy" | "standard";

export function skillsDir(rootPath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/.pragma/skills`;
}

export function isSkillPath(path: string): boolean {
  return /(^|\/)\.pragma\/skills\//.test(path.replace(/\\/g, "/"));
}

/** `standard` for `<id>/SKILL.md`, `legacy` for the single file `<id>.md`. */
export function skillFormat(id: string, path: string): SkillFormat {
  return path.replace(/\\/g, "/").endsWith(`/${id}/${SKILL_FILE_NAME}`) ? "standard" : "legacy";
}
