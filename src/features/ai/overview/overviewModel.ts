import type { AgentState } from "@/shared/components/ui/status-dot";
import type { ChatSession } from "@/shared/stores/ai";
import type { Space } from "@/shared/stores/spaces/model";

import type { AgentStateEntry } from "../state/agentStates";
import { isShellSession } from "../terminal/shell";

export type OverviewFilter = "all" | AgentState;
export type OverviewGroup = "status" | "space";

export const STATE_ORDER: readonly AgentState[] = ["needs-you", "working", "done", "idle"];

/** A chat that was used this recently still shows as idle. */
const RECENT_MS = 24 * 60 * 60 * 1000;

export interface OverviewTile {
  session: ChatSession;
  state: AgentState;
  spaceId: string | null;
  /** When the state last changed, else when the session was last updated. */
  since: number;
}

export interface OverviewInput {
  sessions: readonly ChatSession[];
  entries: Record<string, AgentStateEntry>;
  spaces: readonly Space[];
  /** Sessions whose coding CLI terminal is running. */
  liveTerminals: ReadonlySet<string>;
  /** Sessions open in a pane of some tab; after a restart their CLI starts once the tab shows. */
  openSessions: ReadonlySet<string>;
  now: number;
}

function belongs(session: ChatSession, input: OverviewInput): boolean {
  if (session.archived) return false;
  const entry = input.entries[session.id];
  // A shell counts while a coding CLI in it works or asks; every other count includes it too.
  if (isShellSession(session)) return entry !== undefined && entry.state !== "idle";
  if (entry) return true;
  if (session.kind === "terminal") {
    return input.liveTerminals.has(session.id) || input.openSessions.has(session.id);
  }
  return session.messages.length > 0 && input.now - session.updatedAt < RECENT_MS;
}

/** Every agent session worth showing: those with a state, live or open CLIs and recent chats. */
export function overviewTiles(input: OverviewInput): OverviewTile[] {
  return input.sessions
    .filter((session) => belongs(session, input))
    .map((session) => {
      const entry = input.entries[session.id];
      const space = input.spaces.find((item) => item.folders.includes(session.rootPath));
      return {
        session,
        state: entry?.state ?? "idle",
        spaceId: space?.id ?? null,
        since: entry?.changedAt ?? session.updatedAt,
      };
    })
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        (a.state === "needs-you" ? a.since - b.since : b.since - a.since),
    );
}

export interface OverviewView {
  filter: OverviewFilter;
  spaceId: string | null;
}

export function filterTiles(tiles: readonly OverviewTile[], view: OverviewView): OverviewTile[] {
  return tiles.filter(
    (tile) =>
      (view.filter === "all" || tile.state === view.filter) &&
      (view.spaceId === null || tile.spaceId === view.spaceId),
  );
}

export function countByState(tiles: readonly OverviewTile[]): Record<OverviewFilter, number> {
  const counts: Record<OverviewFilter, number> = {
    all: tiles.length,
    "needs-you": 0,
    working: 0,
    done: 0,
    idle: 0,
  };
  for (const tile of tiles) counts[tile.state] += 1;
  return counts;
}

/** The lines worth showing from a terminal screen: the output above a CLI's input box. */
export function snippetLines(lines: readonly string[], limit: number): string[] {
  const isRule = (line: string) => /[─━═]{12,}/.test(line);
  let end = lines.length;
  // A TUI keeps its input box and status lines at the bottom, fenced off by a horizontal rule.
  const firstRuleNearBottom = lines.findIndex(
    (line, index) => index >= lines.length - 14 && isRule(line),
  );
  if (firstRuleNearBottom > 0) end = firstRuleNearBottom;
  const kept = lines
    .slice(0, end)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !isRule(line));
  return kept.slice(-limit);
}

/** A short "time ago" for tile footers. */
export function sinceLabel(since: number, now: number): string {
  const minutes = Math.floor((now - since) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
