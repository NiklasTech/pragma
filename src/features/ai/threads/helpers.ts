import type { AgentStatus } from "@/features/agent/store";

export type ThreadStatus = "idle" | "running" | "waiting-approval" | "error";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);

  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;

  const date = new Date(timestamp);
  const reference = new Date(now);
  const isToday =
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate();
  if (isToday) return `${Math.floor(diff / HOUR)}h`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/// Only the active thread owns the single live run; every other thread stays idle.
export function resolveThreadStatus(agentStatus: AgentStatus, isActive: boolean): ThreadStatus {
  if (!isActive) return "idle";

  switch (agentStatus) {
    case "running":
      return "running";
    case "waiting-approval":
      return "waiting-approval";
    case "error":
      return "error";
    default:
      return "idle";
  }
}
