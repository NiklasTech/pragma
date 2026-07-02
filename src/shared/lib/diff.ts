export interface DiffSides {
  original: string;
  modified: string;
}

/**
 * Parse a unified diff into original and modified sides.
 * Skips diff metadata/header lines and only processes hunk contents.
 */
export function parseDiffToSides(patchText: string): DiffSides {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];
  let inHunk = false;

  for (const raw of patchText.split("\n")) {
    if (raw.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (raw.startsWith("+")) {
      modifiedLines.push(raw.slice(1));
    } else if (raw.startsWith("-")) {
      originalLines.push(raw.slice(1));
    } else if (raw.startsWith(" ")) {
      const content = raw.slice(1);
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return {
    original: originalLines.join("\n"),
    modified: modifiedLines.join("\n"),
  };
}

export type DiffLineType = "added" | "removed" | "hunk" | "context";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  raw: string;
}

/**
 * Parse a unified diff into display lines, skipping metadata headers.
 */
export function parseDiffLines(patchText: string): DiffLine[] {
  const lines = patchText.split("\n");
  const result: DiffLine[] = [];
  let inHunk = false;

  for (const raw of lines) {
    if (raw.startsWith("@@")) {
      inHunk = true;
      result.push({ type: "hunk", content: raw, raw });
      continue;
    }
    if (!inHunk) continue;

    if (raw.startsWith("+")) {
      result.push({ type: "added", content: raw.slice(1), raw });
    } else if (raw.startsWith("-")) {
      result.push({ type: "removed", content: raw.slice(1), raw });
    } else if (raw.startsWith(" ")) {
      result.push({ type: "context", content: raw.slice(1), raw });
    }
  }

  return result;
}
