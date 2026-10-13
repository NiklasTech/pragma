export type GitRefreshKind = "status" | "all";

/// Runs one git reload at a time and folds requests that arrive meanwhile into a single follow-up.
export function createGitRefreshQueue(
  run: (kind: GitRefreshKind) => Promise<void>,
): (kind: GitRefreshKind) => void {
  let running = false;
  let queued: GitRefreshKind | null = null;

  const request = (kind: GitRefreshKind): void => {
    if (running) {
      queued = queued === "all" ? "all" : kind;
      return;
    }
    running = true;
    void run(kind)
      .catch(() => {})
      .finally(() => {
        running = false;
        const next = queued;
        queued = null;
        if (next) request(next);
      });
  };

  return request;
}
