import type { ChatSession } from "@/shared/stores/ai";
import type { AgentSettings } from "@/shared/stores/settings";

export const DEFAULT_MAX_SESSION_DEPTH = 3;
export const DEFAULT_MAX_CHILD_SESSIONS = 4;
export const SESSION_DEPTH_BOUNDS = { min: 2, max: 3 } as const;
export const CHILD_SESSIONS_BOUNDS = { min: 1, max: 8 } as const;
export const MAX_CHILD_TITLE_LENGTH = 80;

const LIMITS_HINT = "Change the limit in Settings > Agents > Child sessions.";

export type ChildKind = "conversation" | "terminal";
/** `parent` joins the parent's environment; `worktree` branches from the parent's worktree when it has one. */
export type ChildEnvironment = "checkout" | "worktree" | "parent";
/** The project setting for a child without an explicit environment. */
export type ChildEnvironmentSetting = "parent" | "worktree";

export interface SpawnLimits {
  maxChildren: number;
  maxDepth: number;
}

export const DEFAULT_SPAWN_LIMITS: SpawnLimits = {
  maxChildren: DEFAULT_MAX_CHILD_SESSIONS,
  maxDepth: DEFAULT_MAX_SESSION_DEPTH,
};

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

export function isWritingSession(session: Pick<ChatSession, "kind">): boolean {
  return session.kind !== "ask";
}

function clampLimit(value: number, bounds: { min: number; max: number }, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

/** The user's limits, kept inside the bounds that stop runaway spawning. */
export function spawnLimits(
  settings: Pick<AgentSettings, "maxChildSessions" | "maxSessionDepth">,
): SpawnLimits {
  return {
    maxChildren: clampLimit(
      settings.maxChildSessions,
      CHILD_SESSIONS_BOUNDS,
      DEFAULT_MAX_CHILD_SESSIONS,
    ),
    maxDepth: clampLimit(settings.maxSessionDepth, SESSION_DEPTH_BOUNDS, DEFAULT_MAX_SESSION_DEPTH),
  };
}

export function parseSpawnRequest(
  input: unknown,
  parent: ChatSession,
  setting?: ChildEnvironmentSetting,
): SpawnParse {
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

  const fallback: ChildEnvironment = isWritingSession(parent)
    ? (setting ?? "worktree")
    : "checkout";
  const environment = readField(input, "environment") ?? fallback;
  if (environment !== "checkout" && environment !== "worktree" && environment !== "parent") {
    return { ok: false, error: "The environment must be checkout, worktree or parent" };
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

export function checkSpawnLimits(
  sessions: ChatSession[],
  parentId: string,
  limits: SpawnLimits = DEFAULT_SPAWN_LIMITS,
): string | null {
  if (sessionDepth(sessions, parentId) + 1 > limits.maxDepth) {
    return `Session nesting is limited to ${limits.maxDepth} levels. ${LIMITS_HINT}`;
  }
  if (childSessions(sessions, parentId).length >= limits.maxChildren) {
    return `This session already has the maximum of ${limits.maxChildren} children. ${LIMITS_HINT}`;
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
