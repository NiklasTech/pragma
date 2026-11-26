import { describe, expect, it, vi } from "vite-plus/test";
import { createGitRefreshQueue, type GitRefreshKind } from "./gitRefreshQueue";

function deferredRunner() {
  const calls: GitRefreshKind[] = [];
  const resolvers: Array<() => void> = [];
  const run = vi.fn(
    (kind: GitRefreshKind) =>
      new Promise<void>((resolve) => {
        calls.push(kind);
        resolvers.push(resolve);
      }),
  );
  const finishNext = async () => {
    resolvers.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { calls, run, finishNext };
}

describe("createGitRefreshQueue", () => {
  it("runs a request right away when idle", () => {
    const { calls, run } = deferredRunner();
    const request = createGitRefreshQueue(run, { minGapMs: 0, now: () => 0 });

    request("status");

    expect(calls).toEqual(["status"]);
  });

  it("folds requests during a running reload into one follow-up", async () => {
    const { calls, run, finishNext } = deferredRunner();
    const request = createGitRefreshQueue(run, { minGapMs: 0, now: () => 0 });

    request("status");
    request("status");
    request("status");
    request("status");
    await finishNext();
    await finishNext();

    expect(calls).toEqual(["status", "status"]);
  });

  it("keeps a full reload when a status reload is requested after it", async () => {
    const { calls, run, finishNext } = deferredRunner();
    const request = createGitRefreshQueue(run, { minGapMs: 0, now: () => 0 });

    request("status");
    request("all");
    request("status");
    await finishNext();

    expect(calls).toEqual(["status", "all"]);
  });

  it("continues after a failed reload", async () => {
    const run = vi.fn<(kind: GitRefreshKind) => Promise<void>>();
    run.mockRejectedValueOnce(new Error("git failed")).mockResolvedValue(undefined);
    const request = createGitRefreshQueue(run, { minGapMs: 0, now: () => 0 });

    request("all");
    request("status");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(run.mock.calls.map(([kind]) => kind)).toEqual(["all", "status"]);
  });

  it("waits at least the minimum gap before a follow-up status reload", async () => {
    vi.useFakeTimers();
    try {
      let clock = 0;
      const { calls, run, finishNext } = deferredRunner();
      const request = createGitRefreshQueue(run, { minGapMs: 1000, now: () => clock });

      request("status");
      request("status");
      clock = 100;
      const finished = finishNext();
      await vi.advanceTimersByTimeAsync(0);
      await finished;
      expect(calls).toEqual(["status"]);

      clock = 1099;
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toEqual(["status"]);
      clock = 1100;
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toEqual(["status", "status"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits twice as long as a slow reload took", async () => {
    vi.useFakeTimers();
    try {
      let clock = 0;
      const { calls, run, finishNext } = deferredRunner();
      const request = createGitRefreshQueue(run, { minGapMs: 1000, now: () => clock });

      request("status");
      request("status");
      clock = 1500;
      const finished = finishNext();
      await vi.advanceTimersByTimeAsync(0);
      await finished;

      clock = 4499;
      await vi.advanceTimersByTimeAsync(2999);
      expect(calls).toEqual(["status"]);
      clock = 4500;
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toEqual(["status", "status"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a full reload without waiting", async () => {
    vi.useFakeTimers();
    try {
      let clock = 0;
      const { calls, run, finishNext } = deferredRunner();
      const request = createGitRefreshQueue(run, { minGapMs: 1000, now: () => clock });

      request("status");
      clock = 100;
      const finished = finishNext();
      await vi.advanceTimersByTimeAsync(0);
      await finished;
      request("status");
      expect(calls).toEqual(["status"]);

      request("all");
      expect(calls).toEqual(["status", "all"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
