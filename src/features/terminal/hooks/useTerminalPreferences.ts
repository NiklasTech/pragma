import { useEffect } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { useSettingsStore } from "@/shared/stores/settings";

/** Applies the cursor settings to a live terminal without recreating it. */
export function useTerminalCursor(term: XTerm | null) {
  const cursorStyle = useSettingsStore((s) => s.terminal.cursorStyle);
  const cursorBlink = useSettingsStore((s) => s.terminal.cursorBlink);

  useEffect(() => {
    if (!term) return;
    term.options.cursorStyle = cursorStyle;
    term.options.cursorBlink = cursorBlink;
  }, [term, cursorStyle, cursorBlink]);
}

export function useCopyOnSelect(term: XTerm | null) {
  const copyOnSelect = useSettingsStore((s) => s.terminal.copyOnSelect);

  useEffect(() => {
    if (!term || !copyOnSelect) return;
    const disposable = term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection) void copyToClipboard(selection);
    });
    return () => disposable.dispose();
  }, [term, copyOnSelect]);
}
