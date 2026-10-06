import type { TerminalEnvVar } from "@/shared/stores/settings";
import { useSettingsStore } from "@/shared/stores/settings";

/** Turns the edited variable list into an env map, skipping rows without a name. */
export function envRecord(vars: readonly TerminalEnvVar[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const { key, value } of vars) {
    const name = key.trim();
    if (name) env[name] = value;
  }
  return env;
}

export function terminalEnvFor(workspaceRoot: string | null): Record<string, string> {
  if (!workspaceRoot) return {};
  return envRecord(useSettingsStore.getState().terminal.envByWorkspace[workspaceRoot] ?? []);
}
