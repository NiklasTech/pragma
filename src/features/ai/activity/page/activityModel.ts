import { stripAnsi } from "../../browser/detect";
import type { UsageWindow } from "../../subscription/types";
import type { DashboardItem } from "../dashboard";

export interface ActivitySections {
  needs: DashboardItem[];
  running: DashboardItem[];
  earlier: DashboardItem[];
}

const EARLIER_LIMIT = 8;

/** A session that ran something: a terminal, or a chat with messages or replies. */
function didWork(session: DashboardItem["session"]): boolean {
  return (
    session.kind === "terminal" ||
    session.messages.length > 0 ||
    (session.usage?.responses ?? 0) > 0
  );
}
const LAST_LINE_CHARS = 200;

/** A moment as "Sat 01:49", or only "01:49" when it is today. */
export function formatMoment(ms: number, now: number): string {
  const time = new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (ms >= startOfDay(now) && ms < startOfDay(now) + DAY_MS) return time;
  const day = new Date(ms).toLocaleDateString("en-US", { weekday: "short" });
  return `${day} ${time}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(now: number): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/// Questions first, longest waiting on top; then what runs; then what ended today, newest first.
export function activitySections(items: readonly DashboardItem[], now: number): ActivitySections {
  const oldestFirst = (a: DashboardItem, b: DashboardItem) => a.since - b.since;
  const dayStart = startOfDay(now);
  return {
    needs: items.filter((item) => item.state === "waiting").sort(oldestFirst),
    running: items.filter((item) => item.state === "working").sort(oldestFirst),
    earlier: items
      .filter((item) => item.state !== "waiting" && item.state !== "working")
      .filter((item) => item.since >= dayStart)
      .filter((item) => item.state !== "idle" || didWork(item.session))
      .sort((a, b) => b.since - a.since)
      .slice(0, EARLIER_LIMIT),
  };
}

/** Every word of the query appears in one of the texts, ignoring case. */
export function matchesFilter(texts: readonly string[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = texts.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export interface PlanLoad {
  key: string;
  windows: readonly UsageWindow[];
}

/// The plan whose fullest window is emptiest, once at least two plans report usage.
export function mostRoomKey(plans: readonly PlanLoad[]): string | null {
  const reported = plans.filter((plan) => plan.windows.length > 0);
  if (reported.length < 2) return null;
  const load = (plan: PlanLoad) => Math.max(...plan.windows.map((window) => window.usedPercent));
  return reported.reduce((best, plan) => (load(plan) < load(best) ? plan : best)).key;
}

export const PLAN_CELLS = 20;

export function filledCells(usedPercent: number, count: number = PLAN_CELLS): number {
  return Math.min(count, Math.max(0, Math.round((usedPercent / 100) * count)));
}

/** The last lines a terminal printed, as they show on screen, oldest first. */
export function lastTerminalLines(buffer: string, count: number): string[] {
  const shown: string[] = [];
  const lines = stripAnsi(buffer).split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0 && shown.length < count; index -= 1) {
    const line = (lines[index].split("\r").pop() ?? "").trimEnd();
    if (line.trim()) shown.unshift(line.slice(0, LAST_LINE_CHARS));
  }
  return shown;
}

/** The last line a terminal printed, as it shows on screen. */
export function lastTerminalLine(buffer: string): string {
  return lastTerminalLines(buffer, 1)[0]?.trim() ?? "";
}
