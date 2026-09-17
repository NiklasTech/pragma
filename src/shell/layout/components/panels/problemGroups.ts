import type { Problem, ProblemSeverity } from "@/shared/stores/problems";

export function countBySeverity(problems: Problem[]): Record<ProblemSeverity, number> {
  return problems.reduce<Record<ProblemSeverity, number>>(
    (counts, problem) => {
      counts[problem.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

export function groupProblemsByFile(
  problems: Problem[],
): { filePath: string; problems: Problem[] }[] {
  const groups = new Map<string, Problem[]>();

  for (const problem of problems) {
    const group = groups.get(problem.filePath);
    if (group) {
      group.push(problem);
    } else {
      groups.set(problem.filePath, [problem]);
    }
  }

  return [...groups.entries()]
    .map(([filePath, fileProblems]) => ({
      filePath,
      problems: [...fileProblems].sort((a, b) => a.line - b.line || a.column - b.column),
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}
