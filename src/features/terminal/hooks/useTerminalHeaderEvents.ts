import { useEffect } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { toast } from "sonner";

import {
  TERMINAL_CLEAR_EVENT,
  TERMINAL_COPY_OUTPUT_EVENT,
  type TerminalTargetEventDetail,
} from "@/shared/lib/terminal-events";

/** All lines of the terminal's buffer, scrollback included, without trailing blank lines. */
export function terminalOutput(term: Pick<XTerm, "buffer">): string {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let index = 0; index < buffer.length; index++) {
    lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/// Clears or copies this session's output when a terminal header button names it.
export function useTerminalHeaderEvents(term: XTerm | null, sessionId: string): void {
  useEffect(() => {
    if (!term) return;
    const isMine = (event: Event) =>
      (event as CustomEvent<TerminalTargetEventDetail>).detail?.sessionId === sessionId;
    const handleClear = (event: Event) => {
      if (isMine(event)) term.clear();
    };
    const handleCopy = (event: Event) => {
      if (!isMine(event)) return;
      void navigator.clipboard.writeText(terminalOutput(term)).then(
        () => toast.success("Terminal output copied"),
        () => toast.error("Could not copy the terminal output"),
      );
    };
    window.addEventListener(TERMINAL_CLEAR_EVENT, handleClear);
    window.addEventListener(TERMINAL_COPY_OUTPUT_EVENT, handleCopy);
    return () => {
      window.removeEventListener(TERMINAL_CLEAR_EVENT, handleClear);
      window.removeEventListener(TERMINAL_COPY_OUTPUT_EVENT, handleCopy);
    };
  }, [term, sessionId]);
}
