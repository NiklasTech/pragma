import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { matchCliManifest } from "@/features/ai/terminal/foregroundCli";
import { getTerminalPtyId } from "@/features/ai/terminal/runner";
import { useAIStore } from "@/shared/stores/ai";

/// How often the shells of the space are checked for a coding CLI in their foreground.
const POLL_MS = 1200;

interface ShellClisState {
  /** Session id of a shell to the manifest id of the CLI running in it. */
  bySession: Record<string, string>;
  replace: (next: Record<string, string>) => void;
}

function sameMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export const useShellClisStore = create<ShellClisState>()((set) => ({
  bySession: {},
  replace: (next) => set((state) => (sameMap(state.bySession, next) ? {} : { bySession: next })),
}));

/// Checks which shells run a coding CLI right now, such as `claude` typed into a shell pane.
export function useShellCliPolling(shellSessionIds: readonly string[]): void {
  const manifests = useAIStore((state) => state.cliManifests);
  const key = shellSessionIds.join("\n");

  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    const replace = useShellClisStore.getState().replace;
    if (ids.length === 0) {
      replace({});
      return;
    }
    let active = true;
    const check = async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (sessionId) => {
          const ptyId = getTerminalPtyId(sessionId);
          if (!ptyId) return;
          try {
            const names = await invoke<string[] | null>("pty_foreground_process", { id: ptyId });
            const manifest = names ? matchCliManifest(names, manifests) : null;
            if (manifest) next[sessionId] = manifest.id;
          } catch {
            // The terminal may have closed between two checks.
          }
        }),
      );
      if (active) replace(next);
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, manifests]);
}
