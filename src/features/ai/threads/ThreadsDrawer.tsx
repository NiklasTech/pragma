import { useCallback, useRef } from "react";

import { useDrawerDismiss } from "@/shared/hooks/useDrawerDismiss";
import { usePresence } from "@/shared/hooks/usePresence";
import { cn } from "@/shared/lib/utils";

import { useAgentsUiStore } from "../store/agentsUi";
import { ThreadList } from "./ThreadList";

// Matches --motion-slow, so the drawer unmounts once it has slid out.
const SLIDE_MS = 250;

/// The unpinned thread list: slides in over the panes and closes on Escape or a click outside.
export function ThreadsDrawer() {
  const open = useAgentsUiStore((state) => !state.threadsPinned && state.threadsOpen);
  const setThreadsOpen = useAgentsUiStore((state) => state.setThreadsOpen);
  const ref = useRef<HTMLElement>(null);
  const { mounted, shown } = usePresence(open, SLIDE_MS);
  const close = useCallback(() => setThreadsOpen(false), [setThreadsOpen]);
  useDrawerDismiss(ref, open, close);

  if (!mounted) return null;

  return (
    <aside
      ref={ref}
      aria-label="Threads"
      inert={!shown}
      className={cn(
        "absolute top-0 bottom-1.5 left-1.5 z-40 flex w-[272px] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-well bg-bg-sheet p-1.5 shadow-[var(--shadow-md)] ring-1 ring-border",
        "transition-[translate,opacity] duration-(--motion-slow) ease-(--motion-ease-out)",
        shown ? "translate-x-0 opacity-100" : "-translate-x-[calc(100%+0.75rem)] opacity-0",
      )}
    >
      <ThreadList />
    </aside>
  );
}
