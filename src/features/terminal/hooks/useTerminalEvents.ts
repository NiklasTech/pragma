import { useEffect, type RefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import {
  dispatchTerminalSelection,
  TERMINAL_COPY_OUTPUT_EVENT,
} from "@/shared/lib/terminal-events";
import { copyToClipboard } from "@/shared/lib/clipboard";

export function useTerminalSelection(termState: XTerm | null) {
  useEffect(() => {
    if (!termState) return;

    const disposable = termState.onSelectionChange(() => {
      dispatchTerminalSelection(termState.getSelection());
    });

    return () => {
      disposable.dispose();
    };
  }, [termState]);
}

// Handles the app-wide clear and copy output commands for the active terminal.
export function useTerminalCommands(termRef: RefObject<XTerm | null>, isActive: boolean) {
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const handleClear = () => {
      if (isActive) term.clear();
    };

    window.addEventListener("pragma:terminal:clear", handleClear);
    return () => window.removeEventListener("pragma:terminal:clear", handleClear);
  }, [isActive]);

  useEffect(() => {
    const handleCopyOutput = () => {
      const term = termRef.current;
      if (!term || !isActive) return;
      const buffer = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
      }
      const text = lines.join("\n").trimEnd();
      if (text) void copyToClipboard(text);
    };

    window.addEventListener(TERMINAL_COPY_OUTPUT_EVENT, handleCopyOutput);
    return () => window.removeEventListener(TERMINAL_COPY_OUTPUT_EVENT, handleCopyOutput);
  }, [isActive]);
}
