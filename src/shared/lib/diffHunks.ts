import type { GitLineSelection } from "@/shared/stores/git";

export interface PatchLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface PatchHunk {
  header: string;
  lines: PatchLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Parses a single-file unified diff into hunks whose lines carry their old and new line numbers. */
export function parsePatchHunks(patchText: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let current: PatchHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patchText.split("\n")) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      current = { header: raw, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;

    if (raw.startsWith("+")) {
      current.lines.push({ type: "added", content: raw.slice(1), oldLine: null, newLine });
      newLine += 1;
    } else if (raw.startsWith("-")) {
      current.lines.push({ type: "removed", content: raw.slice(1), oldLine, newLine: null });
      oldLine += 1;
    } else if (raw.startsWith(" ")) {
      current.lines.push({ type: "context", content: raw.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  return hunks;
}

/** Builds the backend selection for the changed lines among `lines`. */
export function lineSelection(lines: readonly PatchLine[]): GitLineSelection {
  const selection: GitLineSelection = { old_lines: [], new_lines: [] };
  for (const line of lines) {
    if (line.type === "removed" && line.oldLine !== null) selection.old_lines.push(line.oldLine);
    if (line.type === "added" && line.newLine !== null) selection.new_lines.push(line.newLine);
  }
  return selection;
}

/** A stable key for a changed line within one patch. */
export function patchLineKey(line: PatchLine): string {
  return line.type === "removed" ? `-${line.oldLine}` : `+${line.newLine}`;
}

/** Digits of the largest line number, so every line number of a diff gets the same width. */
export function lineNumberDigits(hunks: readonly Pick<PatchHunk, "lines">[]): number {
  let largest = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      largest = Math.max(largest, line.oldLine ?? 0, line.newLine ?? 0);
    }
  }
  return Math.max(2, String(largest).length);
}

/** Where a hunk sits in the new file: "line 12", "lines 12-20", or the old lines when all are gone. */
export function hunkPlace(hunk: Pick<PatchHunk, "lines">): string {
  const numbers = (side: "newLine" | "oldLine") =>
    hunk.lines.map((line) => line[side]).filter((line) => line !== null);
  const fresh = numbers("newLine");
  const shown = fresh.length > 0 ? fresh : numbers("oldLine");
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (first === undefined || last === undefined) return "";
  return first === last ? `line ${first}` : `lines ${first}\u2013${last}`;
}

/** The function or section git names behind the line numbers of a hunk header. */
export function hunkSection(header: string): string {
  return /^@@ [^@]*@@ ?(.*)$/.exec(header)?.[1]?.trim() ?? "";
}

const TAB_COLUMNS = 4;

/** Columns of the longest line, so a long line can be scrolled to instead of being cut off. */
export function longestLine(hunks: readonly Pick<PatchHunk, "lines">[]): number {
  let longest = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const tabs = line.content.split("\t").length - 1;
      longest = Math.max(longest, line.content.length + tabs * (TAB_COLUMNS - 1));
    }
  }
  return longest;
}
