import type { GhCheck } from "./api";

/** The log excerpts sent along stay below what a CLI takes in one paste without trouble. */
const MAX_LOG_CHARS = 8_000;

export interface FailureLog {
  check: GhCheck;
  excerpt: string;
}

function checkName(check: GhCheck): string {
  return check.workflow ? `${check.workflow} / ${check.name}` : check.name;
}

/** The message that hands a CI failure to the agent that opened the pull request. */
export function buildFailureMessage(input: {
  number: number;
  url: string;
  failing: readonly GhCheck[];
  total: number;
  logs: readonly FailureLog[];
}): string {
  const names = input.failing.map(checkName).join(", ");
  const lines = [
    `CI failed on pull request #${input.number} (${input.url}): ${input.failing.length} of ${input.total} checks failed: ${names}.`,
    "Find the cause, fix it, run the failing checks locally where you can, then commit and push to this branch.",
  ];

  let budget = MAX_LOG_CHARS;
  for (const log of input.logs) {
    const excerpt = log.excerpt.trim();
    if (!excerpt || budget <= 0) continue;
    const kept = excerpt.length > budget ? excerpt.slice(excerpt.length - budget) : excerpt;
    budget -= kept.length;
    lines.push("", `Last lines of ${checkName(log.check)}:`, kept);
  }

  const withLink = input.failing.find((check) => check.link);
  if (input.logs.every((log) => !log.excerpt.trim()) && withLink) {
    lines.push("", `The log is at ${withLink.link}.`);
  }
  return lines.join("\n");
}
