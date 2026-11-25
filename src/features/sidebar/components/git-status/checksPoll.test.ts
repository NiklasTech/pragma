import { describe, expect, it } from "vite-plus/test";

import type { GhChecksSummary, GhPullRequest } from "@/shared/stores/github";

import { checksPollMs } from "./checksPoll";

const pr = (
  checks: Partial<GhChecksSummary>,
  state: GhPullRequest["state"] = "OPEN",
): GhPullRequest => ({
  number: 1,
  title: "t",
  url: "u",
  state,
  is_draft: false,
  base_ref: "main",
  checks: { total: 0, passing: 0, failing: 0, pending: 0, ...checks },
});

describe("checksPollMs", () => {
  it("looks often while checks run or have not appeared yet", () => {
    expect(checksPollMs(pr({ total: 2, pending: 1 }))).toBe(30_000);
    expect(checksPollMs(pr({}))).toBe(30_000);
  });

  it("keeps looking after they settled, because the next push starts over", () => {
    expect(checksPollMs(pr({ total: 2, passing: 2 }))).toBe(120_000);
  });

  it("stops for a pull request that is gone or over", () => {
    expect(checksPollMs(null)).toBeNull();
    expect(checksPollMs(pr({ total: 2, pending: 1 }, "MERGED"))).toBeNull();
  });
});
