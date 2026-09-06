export interface ReplaceQueryOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface ReplaceOneTarget {
  line: number;
  column: number;
}

export interface ReplaceAllResult {
  content: string;
  replacementCount: number;
}

export interface ReplaceOneResult {
  content: string;
  replaced: boolean;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchText: string;
}

export interface SearchResultGroup {
  path: string;
  relativePath: string;
  matches: SearchResult[];
}

export interface ReplaceMatchLocation extends ReplaceOneTarget {
  path: string;
}

export interface ReplaceWorkspaceRequest {
  workspaceRoot: string;
  query: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  includeGlobs: string[];
  excludeGlobs: string[];
  skipPaths: string[];
  singlePath: string | null;
  oneMatch: ReplaceMatchLocation | null;
}

export interface ReplaceWorkspaceResult {
  filesChanged: number;
  replacementCount: number;
}

export interface SearchQueryState {
  query: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  includePatterns: string;
  excludePatterns: string;
}

const textEncoder = new TextEncoder();

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildReplaceRegExp(options: ReplaceQueryOptions): RegExp {
  let source = options.useRegex ? options.query : escapeRegExp(options.query);
  if (options.wholeWord) {
    source = `\\b(?:${source})\\b`;
  }
  return new RegExp(source, options.caseSensitive ? "g" : "gi");
}

export function replaceAllInContent(
  content: string,
  options: ReplaceQueryOptions,
  replacement: string,
): ReplaceAllResult {
  const regExp = buildReplaceRegExp(options);
  const parts: string[] = [];
  let replacementCount = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regExp.exec(content)) !== null) {
    if (match[0].length === 0) {
      regExp.lastIndex += 1;
      continue;
    }
    parts.push(content.slice(cursor, match.index), replacement);
    cursor = match.index + match[0].length;
    replacementCount += 1;
  }
  if (replacementCount === 0) {
    return { content, replacementCount };
  }
  parts.push(content.slice(cursor));
  return { content: parts.join(""), replacementCount };
}

function lineByteColumn(line: string, codeUnitIndex: number): number {
  return textEncoder.encode(line.slice(0, codeUnitIndex)).length + 1;
}

// The Rust search reports 1-based UTF-8 byte columns per line, so the target is
// matched by byte column instead of the JS code-unit index.
export function replaceOneMatchInContent(
  content: string,
  options: ReplaceQueryOptions,
  target: ReplaceOneTarget,
  replacement: string,
): ReplaceOneResult {
  if (options.query.length === 0) {
    return { content, replaced: false };
  }

  const lines = content.split("\n");
  const lineIndex = target.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { content, replaced: false };
  }

  const rawLine = lines[lineIndex];
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  const regExp = new RegExp(buildReplaceRegExp(options).source, options.caseSensitive ? "g" : "gi");
  let lineStart = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    lineStart += lines[i].length + 1;
  }

  let match: RegExpExecArray | null;
  let matched: RegExpExecArray | null = null;
  while ((match = regExp.exec(line)) !== null) {
    if (match[0].length === 0) {
      regExp.lastIndex += 1;
      continue;
    }
    if (lineByteColumn(line, match.index) === target.column) {
      matched = match;
      break;
    }
  }

  if (!matched) {
    return { content, replaced: false };
  }

  const from = lineStart + matched.index;
  const to = from + matched[0].length;
  return {
    content: `${content.slice(0, from)}${replacement}${content.slice(to)}`,
    replaced: true,
  };
}

// Paths from the explorer and the Rust search may differ in casing or
// separator style, so comparisons are normalized case-insensitively.
export function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

export function isSameFilePath(a: string, b: string): boolean {
  return normalizePathForCompare(a) === normalizePathForCompare(b);
}

export function isPathInsideRoot(path: string, root: string): boolean {
  const normalizedPath = normalizePathForCompare(path);
  const normalizedRoot = normalizePathForCompare(root).replace(/\/+$/, "");
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function parsePatterns(value: string): string[] {
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function groupSearchResults(
  results: SearchResult[],
  rootPath: string | null,
): SearchResultGroup[] {
  const map = new Map<string, SearchResult[]>();
  for (const result of results) {
    const list = map.get(result.path) ?? [];
    list.push(result);
    map.set(result.path, list);
  }

  const groups: SearchResultGroup[] = [];
  for (const [path, matches] of map.entries()) {
    const relativePath = rootPath ? path.replace(rootPath, "").replace(/^[/\\]/, "") : path;
    groups.push({ path, relativePath, matches });
  }
  groups.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return groups;
}

export function toReplaceQueryOptions(state: SearchQueryState): ReplaceQueryOptions {
  return {
    query: state.query.trim(),
    caseSensitive: state.caseSensitive,
    wholeWord: state.wholeWord,
    useRegex: state.useRegex,
  };
}

export interface ReplaceWorkspaceRequestExtra {
  skipPaths?: string[];
  singlePath?: string;
  oneMatch?: ReplaceMatchLocation;
}

export function buildReplaceWorkspaceRequest(
  rootPath: string,
  state: SearchQueryState,
  extra?: ReplaceWorkspaceRequestExtra,
): { req: ReplaceWorkspaceRequest } {
  return {
    req: {
      workspaceRoot: rootPath,
      query: state.query.trim(),
      replacement: state.replacement,
      caseSensitive: state.caseSensitive,
      wholeWord: state.wholeWord,
      useRegex: state.useRegex,
      includeGlobs: parsePatterns(state.includePatterns),
      excludeGlobs: parsePatterns(state.excludePatterns),
      skipPaths: extra?.skipPaths ?? [],
      singlePath: extra?.singlePath ?? null,
      oneMatch: extra?.oneMatch ?? null,
    },
  };
}
