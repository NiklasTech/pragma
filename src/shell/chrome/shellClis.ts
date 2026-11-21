import { useEffect } from "react";
import { create } from "zustand";

import { matchCliManifest } from "@/features/ai/terminal/foregroundCli";
import { useForegroundStore, watchForeground } from "@/features/ai/terminal/foregroundPoller";
import { useAIStore } from "@/shared/stores/ai";

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
  const names = useForegroundStore((state) => state.names);
  const key = shellSessionIds.join("\n");

  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    const stops = ids.map(watchForeground);
    return () => stops.forEach((stop) => stop());
  }, [key]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const sessionId of key ? key.split("\n") : []) {
      const found = names[sessionId];
      const manifest = found ? matchCliManifest(found, manifests) : null;
      if (manifest) next[sessionId] = manifest.id;
    }
    useShellClisStore.getState().replace(next);
  }, [key, names, manifests]);
}
