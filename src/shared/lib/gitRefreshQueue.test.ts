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
    const request = createGitRefreshQueue(run);

    request("status");

    expect(calls).toEqual(["status"]);
  });

  it("folds requests during a running reload into one follow-up", async () => {
    const { calls, run, finishNext } = deferredRunner();
    const request = createGitRefreshQueue(run);

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
    const request = createGitRefreshQueue(run);

    request("status");
    request("all");
    request("status");
    await finishNext();

    expect(calls).toEqual(["status", "all"]);
  });

  it("continues after a failed reload", async () => {
    const run = vi.fn<(kind: GitRefreshKind) => Promise<void>>();
    run.mockRejectedValueOnce(new Error("git failed")).mockResolvedValue(undefined);
    const request = createGitRefreshQueue(run);

    request("all");
    request("status");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(run.mock.calls.map(([kind]) => kind)).toEqual(["all", "status"]);
  });
});
