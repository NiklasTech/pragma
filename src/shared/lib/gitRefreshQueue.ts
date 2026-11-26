export type GitRefreshKind = "status" | "all";

interface GitRefreshQueueOptions {
  /** The shortest pause between two reloads. */
  minGapMs?: number;
  now?: () => number;
}

const MIN_GAP_MS = 1000;

/// Runs one git reload at a time and folds requests that arrive meanwhile into a single follow-up.
/// A follow-up status reload waits twice as long as the last reload took, at least `minGapMs`, so
/// agents writing files nonstop do not keep `git status` running back to back; a full reload
/// (branch, refs) never waits.
export function createGitRefreshQueue(
  run: (kind: GitRefreshKind) => Promise<void>,
  { minGapMs = MIN_GAP_MS, now = () => performance.now() }: GitRefreshQueueOptions = {},
): (kind: GitRefreshKind) => void {
  let running = false;
  let queued: GitRefreshKind | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let readyAt = 0;

  const start = (kind: GitRefreshKind): void => {
    running = true;
    const began = now();
    void run(kind)
      .catch(() => {})
      .finally(() => {
        running = false;
        const ended = now();
        readyAt = ended + Math.max(minGapMs, (ended - began) * 2);
        flush();
      });
  };

  const flush = (): void => {
    if (running || timer || !queued) return;
    const wait = queued === "all" ? 0 : readyAt - now();
    if (wait <= 0) {
      const kind = queued;
      queued = null;
      start(kind);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, wait);
  };

  return (kind: GitRefreshKind): void => {
    queued = queued === "all" ? "all" : kind;
    if (kind === "all" && timer) {
      clearTimeout(timer);
      timer = null;
    }
    flush();
  };
}
