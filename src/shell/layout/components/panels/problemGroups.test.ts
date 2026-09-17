import { describe, expect, it } from "vite-plus/test";
import type { Problem } from "@/shared/stores/problems";
import { countBySeverity, groupProblemsByFile } from "./problemGroups";

function problem(overrides: Partial<Problem>): Problem {
  return {
    id: "problem",
    severity: "error",
    message: "message",
    filePath: "/workspace/a.ts",
    line: 1,
    column: 1,
    source: "lsp",
    ...overrides,
  };
}

describe("countBySeverity", () => {
  it("counts each severity", () => {
    expect(
      countBySeverity([
        problem({ severity: "error" }),
        problem({ severity: "error" }),
        problem({ severity: "warning" }),
        problem({ severity: "info" }),
      ]),
    ).toEqual({ error: 2, warning: 1, info: 1 });
  });

  it("returns zeroes for no problems", () => {
    expect(countBySeverity([])).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe("groupProblemsByFile", () => {
  it("groups by file and sorts files and rows", () => {
    const groups = groupProblemsByFile([
      problem({ id: "b2", filePath: "/workspace/b.ts", line: 9 }),
      problem({ id: "a2", filePath: "/workspace/a.ts", line: 7, column: 2 }),
      problem({ id: "a1", filePath: "/workspace/a.ts", line: 3 }),
    ]);

    expect(groups.map((group) => group.filePath)).toEqual(["/workspace/a.ts", "/workspace/b.ts"]);
    expect(groups[0].problems.map((entry) => entry.id)).toEqual(["a1", "a2"]);
    expect(groups[1].problems.map((entry) => entry.id)).toEqual(["b2"]);
  });

  it("keeps every problem of a file in one group", () => {
    const groups = groupProblemsByFile([
      problem({ id: "1", severity: "error" }),
      problem({ id: "2", severity: "warning" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].problems).toHaveLength(2);
  });
});
