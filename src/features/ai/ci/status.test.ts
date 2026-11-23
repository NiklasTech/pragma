import { describe, expect, it } from "vite-plus/test";

import type { GhCheck } from "./api";
import { ciLabel, ciStatus } from "./status";

function check(name: string, bucket: string, link = ""): GhCheck {
  return { name, workflow: "CI", bucket, link };
}

describe("ciStatus", () => {
  it("is null while no check counts", () => {
    expect(ciStatus([])).toBeNull();
    expect(ciStatus([check("deploy", "skipping"), check("mac", "cancel")])).toBeNull();
  });

  it("fails as soon as one check failed, even while others run", () => {
    const status = ciStatus([
      check("test", "fail", "https://github.com/o/r/actions/runs/1/job/2"),
      check("lint", "pending"),
      check("build", "pass"),
      check("mac", "cancel"),
    ]);
    expect(status?.state).toBe("failing");
    expect(status?.failing.map((item) => item.name)).toEqual(["test"]);
    expect(status?.pending).toBe(1);
    expect(status?.total).toBe(3);
    expect(ciLabel(status!)).toBe("CI 1 failing");
  });

  it("runs while checks are pending and passes once all passed", () => {
    expect(ciStatus([check("a", "pass"), check("b", "pending")])?.state).toBe("pending");
    const passed = ciStatus([check("a", "pass"), check("b", "skipping")]);
    expect(passed?.state).toBe("passing");
    expect(ciLabel(passed!)).toBe("CI passed");
  });

  it("names a set of failures the same in any order, and a new run differently", () => {
    const first = ciStatus([check("a", "fail", "https://x/1"), check("b", "fail", "https://x/2")]);
    const reordered = ciStatus([
      check("b", "fail", "https://x/2"),
      check("a", "fail", "https://x/1"),
    ]);
    const rerun = ciStatus([check("a", "fail", "https://x/3"), check("b", "fail", "https://x/2")]);
    expect(first?.failureKey).toBe(reordered?.failureKey);
    expect(first?.failureKey).not.toBe(rerun?.failureKey);
    expect(ciStatus([check("ext", "fail")])?.failureKey).toBe("CI/ext");
  });
});
