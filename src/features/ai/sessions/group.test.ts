import { describe, expect, it } from "vite-plus/test";

import { groupEnvironmentRequest, sharesFiles } from "./group";

const first = { environment: "worktree" as const, environmentId: "env-1" };

describe("groupEnvironmentRequest", () => {
  it("gives every isolated session its own worktree", () => {
    expect(groupEnvironmentRequest("isolated", undefined)).toEqual({ environment: "worktree" });
    expect(groupEnvironmentRequest("isolated", first)).toEqual({ environment: "worktree" });
  });

  it("creates one worktree for a shared group and joins it afterwards", () => {
    expect(groupEnvironmentRequest("shared", undefined)).toEqual({ environment: "worktree" });
    expect(groupEnvironmentRequest("shared", first)).toEqual({ sameEnvironmentAs: first });
  });

  it("starts every checkout session in the checkout", () => {
    expect(groupEnvironmentRequest("checkout", first)).toEqual({ environment: "checkout" });
  });
});

describe("sharesFiles", () => {
  it("warns only when several sessions work in one place", () => {
    expect(sharesFiles("isolated", 4)).toBe(false);
    expect(sharesFiles("shared", 1)).toBe(false);
    expect(sharesFiles("shared", 2)).toBe(true);
    expect(sharesFiles("checkout", 4)).toBe(true);
  });
});
