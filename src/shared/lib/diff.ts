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
