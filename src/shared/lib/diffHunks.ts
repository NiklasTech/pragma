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
