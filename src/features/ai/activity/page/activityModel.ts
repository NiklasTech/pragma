import { stripAnsi } from "../../browser/detect";
import type { UsageWindow } from "../../subscription/types";
import type { DashboardItem } from "../dashboard";

export interface ActivitySections {
  needs: DashboardItem[];
  running: DashboardItem[];
  earlier: DashboardItem[];
}

const EARLIER_LIMIT = 8;
const LAST_LINE_CHARS = 200;

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

/** The last line a terminal printed, as it shows on screen. */
export function lastTerminalLine(buffer: string): string {
  const lines = stripAnsi(buffer).split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const shown = (lines[index].split("\r").pop() ?? "").trim();
    if (shown) return shown.slice(0, LAST_LINE_CHARS);
  }
  return "";
}
