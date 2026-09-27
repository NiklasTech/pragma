export function skillsDir(rootPath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/.pragma/skills`;
}

export function isSkillPath(path: string): boolean {
  return /(^|\/)\.pragma\/skills\//.test(path.replace(/\\/g, "/"));
}
