import { useCallback, useRef } from "react";

import { useDrawerDismiss } from "@/shared/hooks/useDrawerDismiss";
import { usePresence } from "@/shared/hooks/usePresence";

import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "@/shell/layout/store";

import { useAgentFilesStore } from "./agentSheetStore";
import { SidebarContent } from "./Sidebar";
import { useCodeTabForOpenedFiles } from "./useCodeTabForOpenedFiles";

// Matches --motion-slow, so the drawer unmounts once it has slid out.
const SLIDE_MS = 250;

/// The unpinned sidebar: a sheet on the edges of the workspace that closes on Escape or a click outside.
export function SidebarDrawer({ overAgents = false }: { overAgents?: boolean }) {
  const sidebar = useLayoutStore((s) => s.sidebar);
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);
  const agentFilesOpen = useAgentFilesStore((s) => s.open);
  const setAgentFilesOpen = useAgentFilesStore((s) => s.setOpen);
  const ref = useRef<HTMLDivElement>(null);
  // Over the agents the drawer has its own state; in the code tab it is the unpinned sidebar.
  const open = overAgents
    ? agentFilesOpen
    : !sidebar.pinned && !sidebar.collapsed && sidebar.position !== "hidden";
  const { mounted, shown } = usePresence(open, SLIDE_MS);
  const fromRight = !overAgents && sidebar.position === "right";
  const close = useCallback(
    () => (overAgents ? setAgentFilesOpen(false) : setSidebarCollapsed(true)),
    [overAgents, setAgentFilesOpen, setSidebarCollapsed],
  );
  useDrawerDismiss(ref, open, close);
  useCodeTabForOpenedFiles(overAgents && open, close);

  if (!mounted) return null;

  return (
    <aside
      ref={ref}
      aria-label="Sidebar"
      inert={!shown}
      style={{ width: sidebar.width }}
      className={cn(
        "absolute z-40 max-w-[calc(100%-1rem)] overflow-hidden rounded-well bg-bg-sheet shadow-[var(--shadow-md)] ring-1 ring-border",
        "transition-[translate,opacity] duration-(--motion-slow) ease-(--motion-ease-out)",
        // Over the agents it starts beside the rail, as the agent list does.
        overAgents ? "top-0 bottom-1.5 left-11" : "inset-y-0",
        !overAgents && (fromRight ? "right-0" : "left-0"),
        shown
          ? "translate-x-0 opacity-100"
          : fromRight
            ? "translate-x-[calc(100%+0.75rem)] opacity-0"
            : "-translate-x-[calc(100%+0.75rem)] opacity-0",
      )}
    >
      <SidebarContent />
    </aside>
  );
}
