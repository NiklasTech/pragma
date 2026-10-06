export function readStringInput(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function readNumberInput(input: unknown, key: string): number | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readBooleanInput(input: unknown, key: string): boolean {
  if (typeof input !== "object" || input === null) return false;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : false;
}

export function resolveWorkspacePath(rootPath: string, path: string): string {
  const trimmed = path.trim();
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed)) {
    return trimmed;
  }
  return `${rootPath.replace(/[\\/]+$/, "")}/${trimmed.replace(/^[\\/]+/, "")}`;
}
