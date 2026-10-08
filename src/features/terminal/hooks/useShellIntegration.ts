import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  CommandTracker,
  isFailure,
  type FinishedCommand,
} from "../shellIntegration/commandTracker";

export interface ShellIntegration {
  failure: FinishedCommand | null;
  dismissFailure: () => void;
}

// Tracks shell commands in `term` and jumps between them while focus is inside `rootRef`.
export function useShellIntegration(
  term: XTerm | null,
  rootRef: RefObject<HTMLElement | null>,
): ShellIntegration {
  const trackerRef = useRef<CommandTracker | null>(null);
  const [failure, setFailure] = useState<FinishedCommand | null>(null);

  useEffect(() => {
    if (!term) return;
    const tracker = new CommandTracker(term, {
      onCommandStart: () => setFailure(null),
      onCommandEnd: (command) => setFailure(isFailure(command) ? command : null),
      onSelect: setFailure,
    });
    trackerRef.current = tracker;
    return () => {
      tracker.dispose();
      trackerRef.current = null;
      setFailure(null);
    };
  }, [term]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement)) return;
      const { shortcuts } = useSettingsStore.getState();
      const direction = matchShortcut(event, shortcuts["terminal.previousCommand"])
        ? "previous"
        : matchShortcut(event, shortcuts["terminal.nextCommand"])
          ? "next"
          : null;
      if (!direction) return;
      event.preventDefault();
      trackerRef.current?.jump(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rootRef]);

  const dismissFailure = useCallback(() => setFailure(null), []);

  return { failure, dismissFailure };
}
