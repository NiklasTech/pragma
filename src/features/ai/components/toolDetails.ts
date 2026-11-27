export interface ToolDiff {
  path: string;
  /** Null for a new file. */
  oldText: string | null;
  newText: string;
}

export interface ToolLocation {
  path: string;
  line: number | null;
}

export interface ToolDetails {
  diffs: ToolDiff[];
  locations: ToolLocation[];
}

export interface DiffLine {
  kind: "added" | "removed" | "context";
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/// The file changes and files a coding CLI reported for a tool call, from its tool metadata.
export function toolDetails(metadata: unknown): ToolDetails {
  if (!isRecord(metadata)) return { diffs: [], locations: [] };
  const diffs = records(metadata.diffs).flatMap((diff): ToolDiff[] =>
    typeof diff.path === "string" && typeof diff.new_text === "string"
      ? [
          {
            path: diff.path,
            oldText: typeof diff.old_text === "string" ? diff.old_text : null,
            newText: diff.new_text,
          },
        ]
      : [],
  );
  const locations = records(metadata.locations).flatMap((location): ToolLocation[] =>
    typeof location.path === "string"
      ? [{ path: location.path, line: typeof location.line === "number" ? location.line : null }]
      : [],
  );
  return { diffs, locations };
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Beyond this many lines on both sides a diff lists the old lines removed and the new added. */
const MAX_DIFF_CELLS = 250_000;

/// The lines of a change, removed and added lines between the unchanged ones (LCS based).
export function lineDiff(oldText: string | null, newText: string): DiffLine[] {
  const before = splitLines(oldText ?? "");
  const after = splitLines(newText);
  if (before.length * after.length > MAX_DIFF_CELLS) {
    return [
      ...before.map((text): DiffLine => ({ kind: "removed", text })),
      ...after.map((text): DiffLine => ({ kind: "added", text })),
    ];
  }

  // common[i][j]: length of the longest common subsequence of before[i..] and after[j..].
  const common = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      common[i][j] =
        before[i] === after[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ kind: "context", text: before[i] });
      i += 1;
      j += 1;
    } else if (i < before.length && (j >= after.length || common[i + 1][j] >= common[i][j + 1])) {
      // Removed lines come first, as in a unified diff.
      lines.push({ kind: "removed", text: before[i] });
      i += 1;
    } else {
      lines.push({ kind: "added", text: after[j] });
      j += 1;
    }
  }
  return lines;
}

export function diffCounts(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
  };
}

/// A path for display: relative to the folder when it lies inside, else as it is.
export function displayPath(path: string, root: string | null): string {
  if (root && path.startsWith(`${root.replace(/\/+$/, "")}/`)) {
    return path.slice(root.replace(/\/+$/, "").length + 1);
  }
  return path;
}
