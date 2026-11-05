import type { Terminal } from "@xterm/xterm";

/// Repaints old output silently: answers to its stale queries would reach the shell as typed input, and PSReadLine beeps on them.
export function replayWithoutReplies(term: Pick<Terminal, "options" | "write">, data: string) {
  term.options.disableStdin = true;
  term.write(data, () => {
    term.options.disableStdin = false;
  });
}
