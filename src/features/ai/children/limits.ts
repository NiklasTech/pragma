import type { ChatSession } from "@/shared/stores/ai";

export const MAX_SESSION_DEPTH = 3;
export const MAX_CHILD_SESSIONS = 4;
export const MAX_CHILD_TITLE_LENGTH = 80;

export type ChildKind = "conversation" | "terminal";
export type ChildEnvironment = "checkout" | "worktree";

export interface SpawnRequest {
  title: string;
  prompt: string;
  kind: ChildKind;
  environment: ChildEnvironment;
  cli: string | null;
}

export type SpawnParse = { ok: true; request: SpawnRequest } | { ok: false; error: string };

function readField(input: unknown, key: string): unknown {
  if (typeof input !== "object" || input === null) return undefined;
  return (input as Record<string, unknown>)[key];
}

function readText(input: unknown, key: string): string {
  const value = readField(input, key);
  return typeof value === "string" ? value.trim() : "";
}

export function isWritingSession(session: ChatSession): boolean {
  return session.kind !== "ask" && session.kind !== "terminal";
}

export function parseSpawnRequest(input: unknown, parent: ChatSession): SpawnParse {
  const title = readText(input, "title");
  if (title.length === 0 || title.length > MAX_CHILD_TITLE_LENGTH) {
    return { ok: false, error: `The title must be 1 to ${MAX_CHILD_TITLE_LENGTH} characters` };
  }

  const prompt = readText(input, "prompt");
  if (!prompt) return { ok: false, error: "The prompt is required" };

  const kind = readField(input, "kind") ?? "conversation";
  if (kind !== "conversation" && kind !== "terminal") {
    return { ok: false, error: "The kind must be conversation or terminal" };
  }

  const fallback: ChildEnvironment = isWritingSession(parent) ? "worktree" : "checkout";
  const environment = readField(input, "environment") ?? fallback;
  if (environment !== "checkout" && environment !== "worktree") {
    return { ok: false, error: "The environment must be checkout or worktree" };
  }

  const cli = readText(input, "cli") || null;
  if (kind === "terminal" && !cli) {
    return { ok: false, error: "A terminal session needs the id of a detected CLI" };
  }

  return { ok: true, request: { title, prompt, kind, environment, cli } };
}

export function childSessions(sessions: ChatSession[], parentId: string): ChatSession[] {
  return sessions.filter((session) => session.parentId === parentId && !session.archived);
}

/// Depth of a session in its family; a session without a parent is level 1.
export function sessionDepth(sessions: ChatSession[], sessionId: string): number {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const seen = new Set([sessionId]);
  let depth = 1;
  let current = byId.get(sessionId);
  while (current?.parentId && !seen.has(current.parentId)) {
    current = byId.get(current.parentId);
    if (!current) break;
    seen.add(current.id);
    depth += 1;
  }
  return depth;
}

export function checkSpawnLimits(sessions: ChatSession[], parentId: string): string | null {
  if (sessionDepth(sessions, parentId) + 1 > MAX_SESSION_DEPTH) {
    return `Session nesting is limited to ${MAX_SESSION_DEPTH} levels`;
  }
  if (childSessions(sessions, parentId).length >= MAX_CHILD_SESSIONS) {
    return `This session already has ${MAX_CHILD_SESSIONS} children`;
  }
  return null;
}

export function descendantIds(sessions: ChatSession[], parentId: string): string[] {
  const ids: string[] = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const session of sessions) {
      if (session.parentId !== current || ids.includes(session.id) || session.id === parentId) {
        continue;
      }
      ids.push(session.id);
      queue.push(session.id);
    }
  }
  return ids;
}

export interface SessionTree<T> {
  roots: T[];
  childrenOf: Map<string, T[]>;
}

/// Nests sessions under a listed parent; a session whose parent is not listed stays a root.
export function buildSessionTree<T extends { id: string; parentId?: string }>(
  sessions: T[],
): SessionTree<T> {
  const listed = new Set(sessions.map((session) => session.id));
  const roots: T[] = [];
  const childrenOf = new Map<string, T[]>();
  for (const session of sessions) {
    const parentId = session.parentId;
    if (parentId && parentId !== session.id && listed.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(session);
      childrenOf.set(parentId, siblings);
    } else {
      roots.push(session);
    }
  }
  return { roots, childrenOf };
}
