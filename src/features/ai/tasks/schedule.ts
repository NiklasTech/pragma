import type { TaskSchedule } from "./types";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/// The first scheduled local time strictly after `after`; missed times are never caught up.
export function nextRunAt(schedule: TaskSchedule, after: number): number {
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(schedule.hour, schedule.minute);
  if (schedule.frequency === "weekly") {
    const weekday = schedule.weekday ?? 0;
    next.setDate(next.getDate() + ((weekday - next.getDay() + 7) % 7));
    if (next.getTime() <= after) next.setDate(next.getDate() + 7);
  } else if (next.getTime() <= after) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function describeSchedule(schedule: TaskSchedule): string {
  const time = formatTime(schedule.hour, schedule.minute);
  return schedule.frequency === "weekly"
    ? `${WEEKDAYS[schedule.weekday ?? 0]} at ${time}`
    : `Daily at ${time}`;
}

/// Parses "HH:MM" from a time input.
export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/// The session title of a scheduled run, so runs of one task never share a name.
export function scheduledRunTitle(title: string, at: number): string {
  return `${title.trim()} ${new Date(at).toLocaleDateString()}`;
}
