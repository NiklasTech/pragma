import { isValidSkillId } from "@/features/ai/skills/parse";

export type ContextMentionKind = "symbol" | "problems" | "diff" | "terminal" | "url" | "skill";

export const CONTEXT_MENTION_KINDS: readonly { kind: ContextMentionKind; description: string }[] = [
  { kind: "symbol", description: "A function or type from the workspace" },
  { kind: "problems", description: "Current errors and warnings" },
  { kind: "diff", description: "Staged or unstaged changes, or a commit" },
  { kind: "terminal", description: "Recent output of a terminal tab" },
  { kind: "url", description: "Readable text of a web page" },
  { kind: "skill", description: "Steps from a workspace skill" },
];

export type ContextMention =
  | { kind: "symbol"; name: string; path: string; line: number }
  | { kind: "problems"; path: string | null }
  | { kind: "diff"; target: "staged" | "unstaged" }
  | { kind: "diff"; target: "commit"; sha: string }
  | { kind: "terminal"; sessionId: string }
  | { kind: "url"; url: string }
  | { kind: "skill"; id: string };

const ALL_PROBLEMS = "all";
const SHA_PATTERN = /^[0-9a-f]{4,64}$/i;
const TERMINAL_ID_PATTERN = /^[0-9a-z-]{1,64}$/i;

function decodePath(path: string): string | null {
  try {
    return decodeURI(path);
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Mention tokens end at whitespace, so names and paths are URI-encoded.
export function formatContextMention(mention: ContextMention): string {
  switch (mention.kind) {
    case "symbol":
      return `symbol:${encodeURIComponent(mention.name)}:${encodeURI(mention.path)}:${mention.line}`;
    case "problems":
      return `problems:${mention.path === null ? ALL_PROBLEMS : encodeURI(mention.path)}`;
    case "diff":
      return `diff:${mention.target === "commit" ? mention.sha : mention.target}`;
    case "terminal":
      return `terminal:${mention.sessionId}`;
    case "url":
      return `url:${mention.url}`;
    case "skill":
      return `skill:${mention.id}`;
  }
}

function parseSymbol(rest: string): ContextMention | null {
  const nameEnd = rest.indexOf(":");
  const lineStart = rest.lastIndexOf(":");
  if (nameEnd <= 0 || lineStart <= nameEnd + 1) return null;
  const line = Number(rest.slice(lineStart + 1));
  if (!Number.isInteger(line) || line < 1) return null;
  const path = decodePath(rest.slice(nameEnd + 1, lineStart));
  let name: string;
  try {
    name = decodeURIComponent(rest.slice(0, nameEnd));
  } catch {
    return null;
  }
  return path ? { kind: "symbol", name, path, line } : null;
}

export function parseContextMention(token: string): ContextMention | null {
  const separator = token.indexOf(":");
  if (separator <= 0) return null;
  const kind = token.slice(0, separator);
  const rest = token.slice(separator + 1);
  if (!rest) return null;

  switch (kind) {
    case "symbol":
      return parseSymbol(rest);
    case "problems": {
      if (rest === ALL_PROBLEMS) return { kind: "problems", path: null };
      const path = decodePath(rest);
      return path ? { kind: "problems", path } : null;
    }
    case "diff":
      if (rest === "staged" || rest === "unstaged") return { kind: "diff", target: rest };
      return SHA_PATTERN.test(rest) ? { kind: "diff", target: "commit", sha: rest } : null;
    case "terminal":
      return TERMINAL_ID_PATTERN.test(rest) ? { kind: "terminal", sessionId: rest } : null;
    case "url":
      return isHttpUrl(rest) ? { kind: "url", url: rest } : null;
    case "skill":
      return isValidSkillId(rest) ? { kind: "skill", id: rest } : null;
    default:
      return null;
  }
}

/** Splits a picker query like `symbol:create` into its kind and the text typed after it. */
export function splitMentionQuery(
  query: string,
): { kind: ContextMentionKind; rest: string } | null {
  const separator = query.indexOf(":");
  if (separator <= 0) return null;
  const kind = query.slice(0, separator);
  const match = CONTEXT_MENTION_KINDS.find((entry) => entry.kind === kind);
  return match ? { kind: match.kind, rest: query.slice(separator + 1) } : null;
}
