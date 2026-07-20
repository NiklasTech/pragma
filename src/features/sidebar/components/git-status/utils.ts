export function statusAccent(code: string): string {
  switch (code) {
    case "A":
      return "bg-status-success/80";
    case "M":
      return "bg-status-warning/80";
    case "D":
      return "bg-status-error/80";
    case "R":
      return "bg-status-info/80";
    default:
      return "bg-fg-muted/40";
  }
}

export function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "";
  return normalized.slice(0, index);
}

export function formatRelativeTime(timestampSecs: number): string {
  const now = Date.now();
  const then = timestampSecs * 1000;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(then).toLocaleDateString();
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
