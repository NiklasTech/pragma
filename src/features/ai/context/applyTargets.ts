export interface FencedBlock {
  language: string | null;
  info: string;
  code: string;
  start: number;
}

export interface OpenFileTab {
  id: string;
  path: string;
  name: string;
  content: string;
}

export interface ResolvedApplyTarget {
  path: string;
  name: string;
  code: string;
  originalCode: string;
  tabId: string | null;
}

export interface ResolveApplyTargetsInput {
  messageText: string;
  blocks: readonly FencedBlock[];
  openFiles: readonly OpenFileTab[];
  activePath: string | null;
  rootPath: string | null;
}

const FENCE_REGEX = /```([^\n`]*)\n([\s\S]*?)```/g;
const PATH_CANDIDATE_REGEX = /[A-Za-z0-9_@.-]+(?:\/[A-Za-z0-9_@.-]+)*\.[A-Za-z0-9]+/g;

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rs",
  "go",
  "java",
  "kt",
  "kts",
  "rb",
  "php",
  "cs",
  "cpp",
  "cc",
  "c",
  "h",
  "hpp",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "md",
  "mdx",
  "sh",
  "bash",
  "zsh",
  "fish",
  "sql",
  "vue",
  "svelte",
  "swift",
  "dart",
  "lua",
  "ex",
  "exs",
  "xml",
  "txt",
  "env",
  "proto",
  "gradle",
  "dockerfile",
]);

export function normalizeCode(code: string): string {
  return code.replace(/\n$/, "");
}

export function parseFencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  FENCE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FENCE_REGEX.exec(markdown)) !== null) {
    const info = match[1].trim();
    const language = info.split(/\s+/).filter(Boolean)[0] ?? null;
    blocks.push({
      info,
      language,
      code: normalizeCode(match[2].trim()),
      start: match.index,
    });
  }

  return blocks;
}

export function findPathHints(text: string): string[] {
  const hints: string[] = [];
  PATH_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PATH_CANDIDATE_REGEX.exec(text)) !== null) {
    const candidate = match[0];
    const preceding = match.index > 0 ? text[match.index - 1] : "";
    if (preceding === "/" || preceding === ":") continue;
    if (!isPathLike(candidate)) continue;
    const cleaned = candidate.replace(/^\.\//, "");
    if (!hints.includes(cleaned)) hints.push(cleaned);
  }

  return hints;
}

function isPathLike(candidate: string): boolean {
  if (candidate.length < 3 || candidate.length > 200) return false;
  if (candidate.includes("://") || candidate.startsWith("http")) return false;
  if (!candidate.includes(".")) return false;
  const extension = candidate.split(".").pop()?.toLowerCase() ?? "";
  return candidate.includes("/") || CODE_EXTENSIONS.has(extension);
}

function hintFromInfo(info: string): string | null {
  const tokens = info.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  return findPathHints(tokens.slice(1).join(" "))[0] ?? null;
}

function hintFromCode(code: string): string | null {
  const firstLine = code.split("\n").find((line) => line.trim().length > 0) ?? "";
  const comment = firstLine.match(/^\s*(?:\/\/|#|<!--|\/\*|--)\s*(.+?)\s*(?:-->|\*\/)?\s*$/);
  if (!comment) return null;
  return findPathHints(comment[1])[0] ?? null;
}

function hintFromMessage(messageText: string, start: number): string | null {
  const windowStart = Math.max(0, start - 400);
  const hints = findPathHints(messageText.slice(windowStart, start));
  return hints[hints.length - 1] ?? null;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function joinRoot(rootPath: string | null, path: string): string {
  const cleaned = path.replace(/^\.\//, "");
  if (isAbsolutePath(cleaned) || !rootPath) return cleaned;
  return `${rootPath.replace(/[\\/]+$/, "")}/${cleaned}`;
}

function matchOpenFile(
  openFiles: readonly OpenFileTab[],
  absolutePath: string,
  rawHint: string,
): OpenFileTab | null {
  const normalized = absolutePath.replace(/\\/g, "/");
  const direct = openFiles.find((file) => file.path.replace(/\\/g, "/") === normalized);
  if (direct) return direct;

  const raw = rawHint.replace(/\\/g, "/").replace(/^\.\//, "");
  return (
    openFiles.find((file) => {
      const path = file.path.replace(/\\/g, "/");
      return path === raw || path.endsWith(`/${raw}`);
    }) ?? null
  );
}

export function resolveApplyTargets(
  input: ResolveApplyTargetsInput,
): Map<string, ResolvedApplyTarget> {
  const targets = new Map<string, ResolvedApplyTarget>();
  const singleBlock = input.blocks.length === 1;

  for (const block of input.blocks) {
    const code = normalizeCode(block.code);
    if (!code.trim()) continue;

    const hint =
      hintFromInfo(block.info) ??
      hintFromCode(code) ??
      hintFromMessage(input.messageText, block.start);

    const fallbackPath = singleBlock
      ? (input.activePath ?? (input.openFiles.length === 1 ? input.openFiles[0].path : null))
      : null;

    const rawHint = hint ?? fallbackPath;
    if (!rawHint) continue;

    const resolved = joinRoot(input.rootPath, rawHint);
    const open = matchOpenFile(input.openFiles, resolved, rawHint);
    const path = open?.path ?? resolved;

    targets.set(code, {
      path,
      name: path.split(/[\\/]/).pop() ?? path,
      code,
      originalCode: open?.content ?? "",
      tabId: open?.id ?? null,
    });
  }

  return targets;
}
