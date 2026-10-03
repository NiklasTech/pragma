export const MAX_RUN_OUTPUT_LINES = 5000;

const FLUSH_INTERVAL_MS = 50;

export function appendCapped(
  lines: readonly string[],
  incoming: readonly string[],
  max: number = MAX_RUN_OUTPUT_LINES,
): string[] {
  if (incoming.length >= max) return incoming.slice(-max);
  const overflow = lines.length + incoming.length - max;
  return (overflow > 0 ? lines.slice(overflow) : lines).concat(incoming);
}

// Collects output lines per process and hands them over in one batch per interval.
export function createRunOutputBatcher(
  flush: (processId: string, lines: string[]) => void,
): (processId: string, line: string) => void {
  const pending = new Map<string, string[]>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushAll = () => {
    timer = null;
    const batches = [...pending];
    pending.clear();
    for (const [processId, lines] of batches) flush(processId, lines);
  };

  return (processId, line) => {
    const lines = pending.get(processId);
    if (lines) lines.push(line);
    else pending.set(processId, [line]);
    timer ??= setTimeout(flushAll, FLUSH_INTERVAL_MS);
  };
}
