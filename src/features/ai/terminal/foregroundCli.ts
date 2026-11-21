import { useEffect, useMemo } from "react";

import { useAIStore, type CLIManifest } from "@/shared/stores/ai";

import { useForegroundStore, watchForeground } from "./foregroundPoller";

/** The program name a manifest's command starts, such as `claude` for `claude --resume`. */
function programName(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? "";
  const name = first.split(/[\\/]/).pop() ?? "";
  return name.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");
}

/** The coding CLI among the names of a foreground process, if one of them starts a known CLI. */
export function matchCliManifest(
  names: readonly string[],
  manifests: readonly CLIManifest[],
): CLIManifest | null {
  const wanted = names.map((name) => name.toLowerCase().replace(/\.(exe|cmd|bat|js|mjs)$/, ""));
  for (const manifest of manifests) {
    const program = programName(manifest.command);
    if (program && wanted.includes(program)) return manifest;
  }
  return null;
}

/** The coding CLI running in a shell pane's terminal right now, or null while the shell waits. */
export function useForegroundCli(sessionId: string, enabled: boolean): CLIManifest | null {
  const manifests = useAIStore((state) => state.cliManifests);
  const names = useForegroundStore((state) => (enabled ? state.names[sessionId] : undefined));

  useEffect(() => {
    if (!enabled) return;
    return watchForeground(sessionId);
  }, [enabled, sessionId]);

  return useMemo(() => (names ? matchCliManifest(names, manifests) : null), [names, manifests]);
}
