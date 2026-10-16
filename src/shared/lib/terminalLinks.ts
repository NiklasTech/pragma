import { normalizePath } from "@/features/ai/named-agents/folders";

export interface PathLink {
  /** Offset of the first character in the text. */
  start: number;
  /** Offset after the last character. */
  end: number;
  path: string;
  line?: number;
  column?: number;
}

// A path with at least one separator, then an optional `:line:col` or `(line,col)` position.
const PATH_PATTERN =
  /(?:[A-Za-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])?(?:[\w.@+-]+[\\/])+[\w.@+-]*[\w@+-](?::(\d+)(?::(\d+))?|\((\d+)(?:,\s*(\d+))?\))?/g;
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const EXPLICIT_PREFIX = /^(?:[A-Za-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])/;

function lastSegment(path: string): string {
  return path.split(/[\\/]/).pop() ?? "";
}

/**
 * Paths in a line of terminal output. Bare relative paths only count with a file extension or
 * a line number, so words like "and/or" stay plain text; URLs are left to the URL handler.
 */
export function findPathLinks(text: string): PathLink[] {
  const urls = [...text.matchAll(URL_PATTERN)].map((m) => [m.index, m.index + m[0].length]);
  const links: PathLink[] = [];
  for (const match of text.matchAll(PATH_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (urls.some(([from, to]) => start < to && end > from)) continue;
    // Part of a longer word, such as an email address or a key=value pair.
    const before = start > 0 ? text[start - 1] : "";
    if (/[\w:=@]/.test(before)) continue;

    const lineText = match[1] ?? match[3];
    const columnText = match[2] ?? match[4];
    const suffixLength =
      lineText === undefined ? 0 : match[0].length - match[0].search(/(?::\d|\(\d)/);
    const path = match[0].slice(0, match[0].length - suffixLength);
    const hasExtension = /\.[A-Za-z0-9]+$/.test(lastSegment(path));
    if (!EXPLICIT_PREFIX.test(path) && !hasExtension && lineText === undefined) continue;

    links.push({
      start,
      end,
      path,
      ...(lineText !== undefined ? { line: Number(lineText) } : {}),
      ...(columnText !== undefined ? { column: Number(columnText) } : {}),
    });
  }
  return links;
}

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

/** The absolute path a terminal path refers to, or null when it cannot be resolved. */
export function resolveTerminalPath(
  path: string,
  cwd: string | null,
  home: string | null,
): string | null {
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return home ? normalizePath(`${home}/${path.slice(2)}`) : null;
  }
  if (isAbsolute(path)) return path.startsWith("/") ? normalizePath(path) : path;
  return cwd ? normalizePath(`${cwd}/${path}`) : null;
}

/** Cmd on macOS and Ctrl elsewhere opens links, like other editors. */
export function isLinkModifier(
  event: Pick<MouseEvent, "metaKey" | "ctrlKey">,
  isMac: boolean,
): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}
