import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore, type CLIManifest } from "@/shared/stores/ai";

import { getTerminalPtyId } from "./runner";

/// How often a shell pane checks which program runs in its foreground.
const POLL_MS = 1200;

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
  const [found, setFound] = useState<CLIManifest | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFound(null);
      return;
    }
    let active = true;
    const check = async () => {
      const ptyId = getTerminalPtyId(sessionId);
      if (!ptyId) return;
      try {
        const names = await invoke<string[] | null>("pty_foreground_process", { id: ptyId });
        if (!active) return;
        const next = names ? matchCliManifest(names, manifests) : null;
        setFound((current) => (current?.id === next?.id ? current : next));
      } catch {
        // The terminal may have closed between two checks.
      }
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, manifests, sessionId]);

  return found;
}
