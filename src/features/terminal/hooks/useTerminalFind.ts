import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";
import { TERMINAL_FIND_EVENT, type TerminalTargetEventDetail } from "@/shared/lib/terminal-events";

export interface TerminalFind {
  search: SearchAddon | null;
  open: boolean;
  focusRequest: number;
  close: () => void;
}

// Loads the search addon and opens the find bar for the shortcut inside `rootRef` or a button naming this session.
export function useTerminalFind(
  term: XTerm | null,
  rootRef: RefObject<HTMLElement | null>,
  sessionId: string,
): TerminalFind {
  const [search, setSearch] = useState<SearchAddon | null>(null);
  const [open, setOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (!term) return;
    const addon = new SearchAddon();
    term.loadAddon(addon);
    setSearch(addon);
    return () => {
      setSearch(null);
      addon.dispose();
    };
  }, [term]);

  useEffect(() => {
    const handleFind = (event: Event) => {
      const target = (event as CustomEvent<TerminalTargetEventDetail | undefined>).detail
        ?.sessionId;
      if (target ? target !== sessionId : !rootRef.current?.contains(document.activeElement))
        return;
      setOpen(true);
      setFocusRequest((request) => request + 1);
    };

    window.addEventListener(TERMINAL_FIND_EVENT, handleFind);
    return () => window.removeEventListener(TERMINAL_FIND_EVENT, handleFind);
  }, [rootRef, sessionId]);

  const close = useCallback(() => {
    search?.clearDecorations();
    term?.clearSelection();
    setOpen(false);
    term?.focus();
  }, [search, term]);

  return { search, open, focusRequest, close };
}
