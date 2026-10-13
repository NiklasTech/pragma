// Discovery never writes to CLI folders, so the enabled state of their skills stays on this machine.
const STORAGE_PREFIX = "pragma.cli-skills.enabled:";

export function cliSkillKey(source: string, id: string): string {
  return `${source}:${id}`;
}

export function readEnabledCliSkills(rootPath: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + rootPath) ?? "[]");
    return new Set(
      Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [],
    );
  } catch {
    return new Set();
  }
}

export function writeEnabledCliSkill(rootPath: string, key: string, enabled: boolean): void {
  const keys = readEnabledCliSkills(rootPath);
  if (enabled) keys.add(key);
  else keys.delete(key);
  try {
    localStorage.setItem(STORAGE_PREFIX + rootPath, JSON.stringify([...keys]));
  } catch {
    throw new Error("Could not save the skill setting");
  }
}
