import type { GitLogEntry } from "@/features/sidebar/components/git-graph/types";

const PR_SUFFIX = /\s*\(#(\d+)\)\s*$/;

/// The subject without a trailing "(#123)" and the pull request number it named.
export function splitPullRequest(subject: string): { title: string; pr: number | null } {
  const match = PR_SUFFIX.exec(subject);
  if (!match) return { title: subject, pr: null };
  return { title: subject.slice(0, match.index), pr: Number(match[1]) };
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/// "2m ago", "5 days ago", "3 weeks ago"; dates further back than a year are written out.
export function relativeTime(timestampSecs: number, nowSecs: number): string {
  const age = Math.max(0, nowSecs - timestampSecs);
  if (age < MINUTE) return "just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h ago`;
  if (age < WEEK) return plural(Math.floor(age / DAY), "day");
  if (age < 5 * WEEK) return plural(Math.floor(age / WEEK), "week");
  if (age < 365 * DAY) return plural(Math.floor(age / (30 * DAY)), "month");
  return new Date(timestampSecs * 1000).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/// Commits whose subject, author, hash or pull request number contain the query.
export function filterCommits(commits: readonly GitLogEntry[], query: string): GitLogEntry[] {
  const needle = query.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return [...commits];
  return commits.filter(
    (commit) =>
      commit.subject.toLowerCase().includes(needle) ||
      commit.author.toLowerCase().includes(needle) ||
      commit.sha.startsWith(needle),
  );
}

/// The initial of a commit author, for the small avatar.
export function authorInitial(author: string): string {
  return (author.trim().charAt(0) || "?").toUpperCase();
}
