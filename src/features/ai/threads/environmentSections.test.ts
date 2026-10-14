import { describe, expect, it } from "vite-plus/test";

import type { WorkEnvironment } from "@/shared/stores/ai";

import { buildEnvironmentSections } from "./environmentSections";

function worktree(id: string, branch: string): WorkEnvironment {
  return { id, kind: "worktree", path: `/wt/${id}`, branch, setupStatus: "ready", setupLog: "" };
}

describe("buildEnvironmentSections", () => {
  it("groups threads by worktree and puts the checkout last", () => {
    const environments = [worktree("b", "pragma/bbbbbbbb"), worktree("a", "pragma/aaaaaaaa")];
    const threads = [
      { id: "1", environmentId: "b" },
      { id: "2" },
      { id: "3", environmentId: "a" },
      { id: "4", environmentId: "b" },
      { id: "5", environmentId: "gone" },
    ];

    const sections = buildEnvironmentSections(threads, environments);

    expect(sections.map((section) => section.label)).toEqual([
      "pragma/aaaaaaaa",
      "pragma/bbbbbbbb",
      "This checkout",
    ]);
    expect(sections[1]?.items.map((item) => item.id)).toEqual(["1", "4"]);
    expect(sections[2]?.items.map((item) => item.id)).toEqual(["2", "5"]);
  });
});
