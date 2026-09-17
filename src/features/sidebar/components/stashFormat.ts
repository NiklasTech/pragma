const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatStashDate(timestampSecs: number, now = Date.now()): string {
  if (!timestampSecs) return "";
  const then = timestampSecs * 1000;
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < MINUTE) return "just now";
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}m ago`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}h ago`;
  if (diffSec < 7 * DAY) return `${Math.floor(diffSec / DAY)}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(then));
}
