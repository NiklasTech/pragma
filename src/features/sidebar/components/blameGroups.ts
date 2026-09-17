import type { GitBlameLine } from "@/shared/stores/git";

export interface GitBlameGroup {
  sha: string;
  shortSha: string;
  author: string;
  timestampSecs: number;
  startLine: number;
  endLine: number;
  lines: string[];
}

export function groupBlameLines(lines: GitBlameLine[]): GitBlameGroup[] {
  const groups: GitBlameGroup[] = [];

  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.sha === line.sha && last.endLine + 1 === line.line) {
      last.endLine = line.line;
      last.lines.push(line.content);
      continue;
    }
    groups.push({
      sha: line.sha,
      shortSha: line.short_sha,
      author: line.author,
      timestampSecs: line.timestamp_secs,
      startLine: line.line,
      endLine: line.line,
      lines: [line.content],
    });
  }

  return groups;
}

export function blameGroupByLine(groups: GitBlameGroup[]): Map<number, GitBlameGroup> {
  const byLine = new Map<number, GitBlameGroup>();
  for (const group of groups) {
    for (let line = group.startLine; line <= group.endLine; line += 1) {
      byLine.set(line, group);
    }
  }
  return byLine;
}
