import type { LspFeatureFlags } from "./client";

const flagsByFile = new Map<string, LspFeatureFlags>();

export function setLspFeatureFlags(filePath: string, flags: LspFeatureFlags): void {
  flagsByFile.set(filePath, flags);
}

export function getLspFeatureFlags(filePath: string): LspFeatureFlags | undefined {
  return flagsByFile.get(filePath);
}

export function clearLspFeatureFlags(filePath: string): void {
  flagsByFile.delete(filePath);
}
