import { useEffect, type RefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { invoke } from "@tauri-apps/api/core";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useSettingsStore } from "@/shared/stores/settings";
import type { UseTerminalSuggestionsReturn } from "@/shared/hooks/useTerminalSuggestions";
import { copyToClipboard, readFromClipboard } from "@/shared/lib/clipboard";
import { getIsMac, matchShortcut } from "@/shared/lib/shortcuts";
import { safePtyInvoke } from "../safePtyInvoke";
import { macTerminalKeyAction } from "../terminalKeymap";

interface TerminalInputOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  termRef: RefObject<XTerm | null>;
  ptyIdRef: RefObject<string | null>;
  termState: XTerm | null;
  suggestions: UseTerminalSuggestionsReturn;
  fontSize: number;
}

// Forwards typing to the PTY and handles Tab, clipboard, macOS terminal and font size shortcuts.
export function useTerminalInput({
  containerRef,
  termRef,
  ptyIdRef,
  termState,
  suggestions,
  fontSize,
}: TerminalInputOptions) {
  useEffect(() => {
    if (!termState) return;

    const handleData = suggestions.handleData;
    const disposable = termState.onData((data) => {
      if (data === "\t") return;

      if (!handleData(data) && ptyIdRef.current) {
        safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data }));
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [termState, suggestions.handleData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      event.preventDefault();
      event.stopPropagation();

      if (suggestions.visible) {
        suggestions.accept();
      } else if (ptyIdRef.current) {
        safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data: "\t" }));
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [suggestions.visible, suggestions.accept]);

  useEffect(() => {
    if (!termState) return;

    // macOS keeps Ctrl+C as SIGINT and uses Cmd for the clipboard instead.
    if (getIsMac()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        const term = termRef.current;
        const selection = term?.getSelection();
        if (selection) {
          void copyToClipboard(selection);
          term?.clearSelection();
          event.preventDefault();
          event.stopPropagation();
        }
        // If nothing is selected, let xterm send Ctrl+C (SIGINT) to the PTY.
      } else if (key === "v") {
        void readFromClipboard().then((text) => {
          if (text && ptyIdRef.current) {
            safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data: text }));
          }
        });
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [termState]);

  useEffect(() => {
    if (!termState || !getIsMac()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = macTerminalKeyAction(event);
      if (!action) return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      const { shortcuts } = useSettingsStore.getState();
      if (Object.values(shortcuts).some((binding) => matchShortcut(event, binding))) return;

      const term = termRef.current;
      if (!term) return;

      if (action.type === "copy") {
        const selection = term.getSelection();
        if (!selection) return;
        void copyToClipboard(selection);
      } else if (action.type === "paste") {
        void readFromClipboard().then((text) => {
          if (text) term.paste(text);
        });
      } else if (action.type === "clear") {
        term.clear();
      } else if (action.type === "selectAll") {
        term.selectAll();
      } else if (ptyIdRef.current) {
        safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data: action.data }));
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [termState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const next = fontSize + 1;
        useTerminalStore.getState().setFontSize(next);
        useSettingsStore.getState().setTerminalSettings({ fontSize: next });
      } else if (event.key === "-") {
        event.preventDefault();
        const next = Math.max(8, fontSize - 1);
        useTerminalStore.getState().setFontSize(next);
        useSettingsStore.getState().setTerminalSettings({ fontSize: next });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [fontSize]);
}
