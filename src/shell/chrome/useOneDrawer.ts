import { useEffect } from "react";

import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { useLayoutStore } from "@/shell/layout/store";

import { useAgentSheetStore } from "./agentSheetStore";

export type Drawer = "agents" | "sidebar" | "threads";

type OpenDrawers = Record<Drawer, boolean>;

/// The drawers to close because another one just opened; the newest stays.
export function drawersToClose(before: OpenDrawers, now: OpenDrawers): Drawer[] {
  const drawers: Drawer[] = ["agents", "sidebar", "threads"];
  const opened = drawers.find((drawer) => now[drawer] && !before[drawer]);
  return opened ? drawers.filter((drawer) => drawer !== opened && now[drawer]) : [];
}

function readOpen(): OpenDrawers {
  const { sidebar } = useLayoutStore.getState();
  const { threadsOpen, threadsPinned } = useAgentsUiStore.getState();
  return {
    agents: useAgentSheetStore.getState().open,
    // Pinned, both are columns beside the workspace and cover nothing.
    sidebar: !sidebar.pinned && !sidebar.collapsed && sidebar.position !== "hidden",
    threads: !threadsPinned && threadsOpen,
  };
}

const CLOSE: Record<Drawer, () => void> = {
  agents: () => useAgentSheetStore.getState().setOpen(false),
  sidebar: () => useLayoutStore.getState().setSidebarCollapsed(true),
  threads: () => useAgentsUiStore.getState().setThreadsOpen(false),
};

/// Keeps the drawers beside the rail from lying on top of each other, however they were opened.
export function useOneDrawer(): void {
  useEffect(() => {
    let before = readOpen();
    const check = () => {
      const now = readOpen();
      const closing = drawersToClose(before, now);
      before = now;
      for (const drawer of closing) CLOSE[drawer]();
    };
    // Two drawers may be left open from before; the agents and then the sidebar stay.
    for (const drawer of drawersToClose(
      { agents: false, sidebar: false, threads: false },
      before,
    )) {
      CLOSE[drawer]();
    }
    before = readOpen();
    const stops = [
      useAgentSheetStore.subscribe(check),
      useLayoutStore.subscribe(check),
      useAgentsUiStore.subscribe(check),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
}
