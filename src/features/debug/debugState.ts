export interface DapEventPayload {
  event: string;
  body?: Record<string, unknown>;
}

export interface DapEventEffect {
  isStopped?: boolean;
  stoppedThreadId?: number | null;
  stopReason?: string;
  appendOutput?: string;
  sessionEnded?: boolean;
}

export function mapDapEvent(payload: DapEventPayload): DapEventEffect {
  const body = payload.body ?? {};

  switch (payload.event) {
    case "stopped":
      return {
        isStopped: true,
        stoppedThreadId: typeof body.threadId === "number" ? body.threadId : null,
        stopReason: typeof body.reason === "string" ? body.reason : undefined,
      };
    case "continued": {
      if (body.allThreadsContinued === false) {
        return {};
      }
      return { isStopped: false, stoppedThreadId: null };
    }
    case "terminated":
    case "exited":
      return { sessionEnded: true, isStopped: false, stoppedThreadId: null };
    case "output":
      return typeof body.output === "string" ? { appendOutput: body.output } : {};
    default:
      return {};
  }
}

export function toggleBreakpointLine(
  breakpoints: Record<string, number[]>,
  file: string,
  line: number,
): Record<string, number[]> {
  const current = breakpoints[file] ?? [];
  const next = current.includes(line)
    ? current.filter((l) => l !== line)
    : [...current, line].sort((a, b) => a - b);

  if (next.length === 0) {
    const copy = { ...breakpoints };
    delete copy[file];
    return copy;
  }
  return { ...breakpoints, [file]: next };
}

export function sameLines(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((line, index) => line === b[index]);
}

export function toFileBreakpoints(
  breakpoints: Record<string, number[]>,
): Array<{ path: string; lines: number[] }> {
  return Object.entries(breakpoints)
    .filter(([, lines]) => lines.length > 0)
    .map(([path, lines]) => ({ path, lines }));
}

const BREAKPOINTS_STORAGE_KEY = "pragma.debug.breakpoints";

export function loadPersistedBreakpoints(): Record<string, number[]> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const result: Record<string, number[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.every((line) => typeof line === "number")) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function persistBreakpoints(breakpoints: Record<string, number[]>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(breakpoints));
  } catch {
    // ignore
  }
}
