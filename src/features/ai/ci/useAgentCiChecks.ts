import { useEffect } from "react";

import { checkAgentPullRequests } from "./tracking";

const PENDING_INTERVAL_MS = 60_000;
const IDLE_INTERVAL_MS = 120_000;

/** Follows the pull requests and CI checks of the folder's agent worktrees while it is open. */
export function useAgentCiChecks(rootPath: string, loaded: boolean): void {
  useEffect(() => {
    if (!loaded) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const pending = await checkAgentPullRequests(rootPath).catch(() => false);
      if (!active) return;
      timer = setTimeout(() => void run(), pending ? PENDING_INTERVAL_MS : IDLE_INTERVAL_MS);
    };
    void run();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rootPath, loaded]);
}
