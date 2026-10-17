import type { GoToFileEntry } from "@/shared/stores/goToFile";

export function toGoToFileEntry(rootPath: string, relativePath: string): GoToFileEntry {
  const name = relativePath.slice(relativePath.lastIndexOf("/") + 1);
  return {
    path: `${rootPath.replace(/[\\/]+$/, "")}/${relativePath}`,
    name,
    relativePath,
    nameKey: name.toLowerCase(),
    pathKey: relativePath.toLowerCase(),
  };
}

/** Where the first subsequence match of `query` in `text` starts and ends, or null. */
function subsequenceSpan(text: string, query: string): { start: number; end: number } | null {
  let position = text.indexOf(query[0]);
  if (position === -1) return null;
  const start = position;
  for (let index = 1; index < query.length; index++) {
    position = text.indexOf(query[index], position + 1);
    if (position === -1) return null;
  }
  return { start, end: position };
}

/** Higher is better; null when the file does not match. Name matches beat path matches. */
export function scoreFile(file: GoToFileEntry, query: string): number | null {
  if (file.nameKey === query) return 10_000;
  if (file.nameKey.startsWith(query)) return 8_000 - file.nameKey.length;
  const inName = file.nameKey.indexOf(query);
  if (inName !== -1) return 6_000 - inName - file.nameKey.length;
  const inPath = file.pathKey.indexOf(query);
  if (inPath !== -1) return 4_000 - inPath - file.pathKey.length;
  const nameSpan = subsequenceSpan(file.nameKey, query);
  if (nameSpan) {
    // An abbreviation like "fe" for FileEditor starts at the first letter of the name.
    const startBonus = nameSpan.start === 0 ? 500 : 0;
    return 2_000 + startBonus - (nameSpan.end - nameSpan.start) - file.nameKey.length;
  }
  const pathSpan = subsequenceSpan(file.pathKey, query);
  if (pathSpan) return 1_000 - (pathSpan.end - pathSpan.start) - file.pathKey.length / 10;
  return null;
}

/** The best `limit` files for the query, ignoring case and spaces; an empty query keeps the listing order. */
export function rankFiles(
  files: GoToFileEntry[],
  rawQuery: string,
  limit: number,
): GoToFileEntry[] {
  const query = rawQuery.toLowerCase().replace(/\s+/g, "");
  if (!query) return files.slice(0, limit);

  const matches: Array<{ file: GoToFileEntry; score: number }> = [];
  for (const file of files) {
    const score = scoreFile(file, query);
    if (score !== null) matches.push({ file, score });
  }
  // The sort is stable, so equal scores keep the path order of the listing.
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit).map((match) => match.file);
}
