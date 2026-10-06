import type { Problem, ProblemSeverity } from "@/shared/stores/problems";

const SEVERITY_ORDER: Record<ProblemSeverity, number> = { error: 0, warning: 1, info: 2 };

export function selectProblems(
  problems: Problem[],
  severities: ProblemSeverity[],
  filePath?: string,
): Problem[] {
  return problems
    .filter((p) => severities.includes(p.severity) && (!filePath || p.filePath === filePath))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.filePath.localeCompare(b.filePath) ||
        a.line - b.line ||
        a.column - b.column,
    );
}

export function formatProblem(problem: Problem): string {
  return `${problem.filePath}:${problem.line}:${problem.column}: ${problem.severity}: ${problem.message} [${problem.source}]`;
}

export function formatProblemList(problems: Problem[], maxProblems: number): string {
  const lines = problems.slice(0, maxProblems).map(formatProblem);
  if (problems.length > maxProblems) {
    lines.push(`... ${problems.length - maxProblems} more problems`);
  }
  return lines.join("\n");
}
