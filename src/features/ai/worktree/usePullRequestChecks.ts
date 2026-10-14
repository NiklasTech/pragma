import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";

import { checkSessionPullRequests } from "./pullRequests";

/** Checks the session pull requests once the threads have loaded and whenever the window gains focus. */
export function usePullRequestChecks(rootPath: string, loaded: boolean): void {
  useEffect(() => {
    if (!loaded) return;
    const check = () => void checkSessionPullRequests(rootPath).catch(() => {});
    check();

    let active = true;
    let unlistenFocus: UnlistenFn | null = null;
    void (async () => {
      try {
        const unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
          if (payload) check();
        });
        if (active) unlistenFocus = unlisten;
        else void unlistenQuietly(unlisten);
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
    })();

    return () => {
      active = false;
      void unlistenQuietly(unlistenFocus);
    };
  }, [rootPath, loaded]);
}
