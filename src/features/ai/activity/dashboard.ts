import { PROVIDER_LABELS } from "@/shared/lib/ai-providers";
import type { AIProvider, ChatSession, CLIManifest } from "@/shared/stores/ai";

export type DashboardState = "waiting" | "working" | "failed" | "finished" | "idle";

export type SessionOutcome = "finished" | "failed";

export interface StateEntry {
  state: DashboardState;
  since: number;
}

export interface StateInput {
  running: ReadonlySet<string>;
  waiting: ReadonlySet<string>;
  terminalWorking: ReadonlySet<string>;
  outcomes: Readonly<Record<string, SessionOutcome>>;
}

export const DASHBOARD_STATE_LABELS: Record<DashboardState, string> = {
  waiting: "Waiting for you",
  working: "Working",
  failed: "Failed",
  finished: "Finished",
  idle: "Idle",
};

export function resolveDashboardState(sessionId: string, input: StateInput): DashboardState {
  if (input.waiting.has(sessionId)) return "waiting";
  if (input.running.has(sessionId) || input.terminalWorking.has(sessionId)) return "working";
  return input.outcomes[sessionId] ?? "idle";
}

/// Keeps when each session entered its state; a session first seen idle counts from its last update.
export function trackStates(
  previous: Readonly<Record<string, StateEntry>>,
  sessions: ReadonlyArray<Pick<ChatSession, "id" | "updatedAt">>,
  input: StateInput,
  now: number,
): Readonly<Record<string, StateEntry>> {
  const next: Record<string, StateEntry> = {};
  let changed = Object.keys(previous).length !== sessions.length;
  for (const session of sessions) {
    const state = resolveDashboardState(session.id, input);
    const before = previous[session.id];
    if (before?.state === state) {
      next[session.id] = before;
      continue;
    }
    changed = true;
    const since = before || state !== "idle" ? now : Math.min(session.updatedAt, now);
    next[session.id] = { state, since };
  }
  return changed ? next : previous;
}

export interface DashboardItem {
  session: ChatSession;
  state: DashboardState;
  since: number;
}

export function formatStateDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 > 0 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/// The CLI a session runs, else the built-in provider and model, pinned or global.
export function engineLabel(
  session: Pick<ChatSession, "kind" | "cliProviderId" | "agentEngine">,
  manifests: ReadonlyArray<Pick<CLIManifest, "id" | "name">>,
  global: { provider: AIProvider; model: string },
): string {
  const cliId =
    session.cliProviderId ??
    (session.agentEngine?.kind === "cli" ? session.agentEngine.cliProviderId : undefined);
  if (cliId) return manifests.find((manifest) => manifest.id === cliId)?.name ?? cliId;
  if (session.kind === "terminal") return "Terminal";
  const pinned = session.agentEngine?.kind === "builtin" ? session.agentEngine : undefined;
  const provider = pinned?.provider ?? global.provider;
  const model = pinned?.provider ? (pinned.model ?? "") : global.model;
  const label = PROVIDER_LABELS[provider];
  return model ? `${label} · ${model}` : label;
}
