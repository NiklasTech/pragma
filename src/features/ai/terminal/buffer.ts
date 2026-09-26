export const TERMINAL_BUFFER_LIMIT = 1_000_000;

export function appendTerminalBuffer(
  buffer: string,
  chunk: string,
  limit = TERMINAL_BUFFER_LIMIT,
): string {
  const combined = buffer + chunk;
  if (combined.length <= limit) return combined;
  return combined.slice(combined.length - limit);
}

export function quoteShellPath(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}
