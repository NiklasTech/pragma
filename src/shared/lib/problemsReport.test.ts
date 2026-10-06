import { describe, expect, it } from "vite-plus/test";

import type { Problem } from "@/shared/stores/problems";

import { formatProblem, selectProblems } from "./problemsReport";

function problem(overrides: Partial<Problem>): Problem {
  return {
    id: "id",
    severity: "error",
    message: "msg",
    filePath: "/w/a.ts",
    line: 1,
    column: 1,
    source: "ts",
    ...overrides,
  };
}

describe("selectProblems", () => {
  const problems = [
    problem({ id: "1", severity: "warning", filePath: "/w/a.ts", line: 3 }),
    problem({ id: "2", severity: "info", filePath: "/w/a.ts" }),
    problem({ id: "3", severity: "error", filePath: "/w/b.ts", line: 9 }),
    problem({ id: "4", severity: "error", filePath: "/w/a.ts", line: 7 }),
  ];

  it("keeps the requested severities with errors first, then by file and line", () => {
    const ids = selectProblems(problems, ["error", "warning"]).map((p) => p.id);
    expect(ids).toEqual(["4", "3", "1"]);
  });

  it("limits the result to one file", () => {
    const ids = selectProblems(problems, ["error", "warning"], "/w/a.ts").map((p) => p.id);
    expect(ids).toEqual(["4", "1"]);
  });
});

describe("formatProblem", () => {
  it("prints location, severity, message and source", () => {
    expect(formatProblem(problem({ line: 4, column: 2, message: "Bad type" }))).toBe(
      "/w/a.ts:4:2: error: Bad type [ts]",
    );
  });
});
