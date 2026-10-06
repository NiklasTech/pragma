import type { Terminal as XTerm } from "@xterm/xterm";

const terminals = new Map<string, XTerm>();

/** Makes a terminal's buffer readable for @terminal mentions; returns the unregister function. */
export function registerTerminalOutput(sessionId: string, term: XTerm): () => void {
  terminals.set(sessionId, term);
  return () => {
    if (terminals.get(sessionId) === term) terminals.delete(sessionId);
  };
}

export function hasTerminalOutput(sessionId: string): boolean {
  return terminals.has(sessionId);
}

export function tailLines(lines: readonly string[], lineLimit: number): string {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(Math.max(0, end - lineLimit), end).join("\n");
}

/** The last lines of a terminal's scrollback, or null when the terminal is not open in this window. */
export function readTerminalOutput(sessionId: string, lineLimit: number): string | null {
  const term = terminals.get(sessionId);
  if (!term) return null;
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
  }
  return tailLines(lines, lineLimit);
}
