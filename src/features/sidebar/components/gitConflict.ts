export type ConflictResolution = "current" | "incoming" | "both";

export interface ConflictHunk {
  index: number;
  startLine: number;
  current: string;
  incoming: string;
  base: string | null;
}

interface RangedHunk extends ConflictHunk {
  startIndex: number;
  endIndex: number;
}

const START_MARKER = "<<<<<<<";
const BASE_MARKER = "|||||||";
const SEPARATOR = "=======";
const END_MARKER = ">>>>>>>";

export function hasConflictMarkers(content: string): boolean {
  return content.split("\n").some((line) => line.startsWith(START_MARKER));
}

function parseRanged(content: string): RangedHunk[] {
  const lines = content.split("\n");
  const hunks: RangedHunk[] = [];
  let index = 0;
  let cursor = 0;

  while (cursor < lines.length) {
    if (!lines[cursor].startsWith(START_MARKER)) {
      cursor += 1;
      continue;
    }
    const startIndex = cursor;
    const startLine = cursor + 1;
    const current: string[] = [];
    const incoming: string[] = [];
    let base: string[] | null = null;
    let section: "current" | "base" | "incoming" = "current";
    cursor += 1;

    while (cursor < lines.length && !lines[cursor].startsWith(END_MARKER)) {
      const line = lines[cursor];
      if (line.startsWith(BASE_MARKER)) {
        base = [];
        section = "base";
      } else if (line.startsWith(SEPARATOR)) {
        section = "incoming";
      } else if (section === "current") {
        current.push(line);
      } else if (section === "base") {
        base?.push(line);
      } else {
        incoming.push(line);
      }
      cursor += 1;
    }

    const endIndex = cursor;
    cursor += 1;
    hunks.push({
      index,
      startLine,
      current: current.join("\n"),
      incoming: incoming.join("\n"),
      base: base ? base.join("\n") : null,
      startIndex,
      endIndex,
    });
    index += 1;
  }

  return hunks;
}

export function parseConflictHunks(content: string): ConflictHunk[] {
  return parseRanged(content).map((hunk) => ({
    index: hunk.index,
    startLine: hunk.startLine,
    current: hunk.current,
    incoming: hunk.incoming,
    base: hunk.base,
  }));
}

function resolutionText(hunk: RangedHunk, resolution: ConflictResolution): string {
  if (resolution === "current") return hunk.current;
  if (resolution === "incoming") return hunk.incoming;
  return [hunk.current, hunk.incoming].filter((part) => part.length > 0).join("\n");
}

export function resolveConflictContent(
  content: string,
  choices: Record<number, ConflictResolution>,
): string {
  const hunks = parseRanged(content);
  if (hunks.length === 0) return content;

  const lines = content.split("\n");
  const output: string[] = [];
  let cursor = 0;

  for (const hunk of hunks) {
    while (cursor < hunk.startIndex) {
      output.push(lines[cursor]);
      cursor += 1;
    }
    const choice = choices[hunk.index];
    if (choice) {
      output.push(...resolutionText(hunk, choice).split("\n"));
    } else {
      while (cursor <= hunk.endIndex) {
        output.push(lines[cursor]);
        cursor += 1;
      }
      continue;
    }
    cursor = hunk.endIndex + 1;
  }

  while (cursor < lines.length) {
    output.push(lines[cursor]);
    cursor += 1;
  }

  return output.join("\n");
}

export function acceptFileResolution(
  current: string,
  incoming: string,
  resolution: ConflictResolution,
): string {
  if (resolution === "current") return current;
  if (resolution === "incoming") return incoming;
  return [current, incoming].filter((part) => part.length > 0).join("\n");
}
