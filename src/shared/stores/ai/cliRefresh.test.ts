import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const loadCLIStatuses = vi.fn(() => Promise.resolve());

vi.mock("@/shared/stores/ai/cliAccounts", () => ({ loadCliAccounts: () => Promise.resolve() }));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ loadCLIStatuses }) },
}));

const { CLI_REFRESH_INTERVAL_MS, refreshCLIStatuses, resetCLIRefresh } =
  await import("./cliRefresh");

describe("refreshCLIStatuses", () => {
  beforeEach(() => {
    loadCLIStatuses.mockClear();
    resetCLIRefresh();
  });

  it("checks once per interval and reuses a running check", async () => {
    const first = refreshCLIStatuses(1000);
    const second = refreshCLIStatuses(1001);
    expect(second).toBe(first);
    await first;
    await refreshCLIStatuses(1000 + CLI_REFRESH_INTERVAL_MS - 1);
    expect(loadCLIStatuses).toHaveBeenCalledTimes(1);

    await refreshCLIStatuses(1000 + CLI_REFRESH_INTERVAL_MS);
    expect(loadCLIStatuses).toHaveBeenCalledTimes(2);
  });
});
