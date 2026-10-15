import { getWorkspaceName } from "@/shared/lib/workspaceName";
import type { ChatSession } from "@/shared/stores/ai";

import { MAX_PANES } from "../panes/operations";
import type { DashboardState, StateEntry } from "./dashboard";

export type RepositoryState = Exclude<DashboardState, "idle">;

/** Order of the counts on an entry and of the sessions a repository opens with. */
export const REPOSITORY_STATES: RepositoryState[] = ["waiting", "working", "failed", "finished"];

export interface RepositorySummary {
  path: string;
  name: string;
  /** Session ids per state, the most recent state change first. */
  sessions: Record<RepositoryState, string[]>;
  latestSessionId: string | null;
}

function emptySessions(): Record<RepositoryState, string[]> {
  return { waiting: [], working: [], failed: [], finished: [] };
}

/// One entry per open repository, in the order they were opened, with its sessions grouped by state.
export function summarizeRepositories(
  paths: readonly string[],
  sessions: ReadonlyArray<Pick<ChatSession, "id" | "rootPath" | "updatedAt" | "archived">>,
  entries: Readonly<Record<string, StateEntry>>,
): RepositorySummary[] {
  const byPath = new Map<string, Array<Pick<ChatSession, "id" | "updatedAt">>>();
  for (const session of sessions) {
    if (session.archived) continue;
    const list = byPath.get(session.rootPath) ?? [];
    list.push(session);
    byPath.set(session.rootPath, list);
  }

  return paths.map((path) => {
    const listed = byPath.get(path) ?? [];
    const grouped = emptySessions();
    const since = new Map<string, number>();
    for (const session of listed) {
      const entry = entries[session.id];
      if (!entry || entry.state === "idle") continue;
      grouped[entry.state].push(session.id);
      since.set(session.id, entry.since);
    }
    for (const state of REPOSITORY_STATES) {
      grouped[state].sort((a, b) => (since.get(b) ?? 0) - (since.get(a) ?? 0));
    }
    const latest = listed.reduce<Pick<ChatSession, "id" | "updatedAt"> | null>(
      (best, session) => (!best || session.updatedAt > best.updatedAt ? session : best),
      null,
    );
    return {
      path,
      name: getWorkspaceName(path),
      sessions: grouped,
      latestSessionId: latest?.id ?? null,
    };
  });
}

export function needsAttention(summary: RepositorySummary): boolean {
  return summary.sessions.waiting.length > 0;
}

/// Sessions that need the user first, then running and ended ones; the latest session when none is active.
export function sessionsToOpen(summary: RepositorySummary): string[] {
  const active = REPOSITORY_STATES.flatMap((state) => summary.sessions[state]);
  if (active.length > 0) return active.slice(0, MAX_PANES);
  return summary.latestSessionId ? [summary.latestSessionId] : [];
}
