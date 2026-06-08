import type { PanelImperativeHandle } from "react-resizable-panels";
import { useLayoutStore } from "../store";
import { cn } from "@/lib/utils";
import {
  Files,
  GitBranch,
  GitDiff,
  MagnifyingGlass,
  SidebarSimple,
  Sidebar as SidebarIcon,
} from "@phosphor-icons/react";
import { FileExplorer, GitGraph, GitStatus, LocalHistoryPanel } from "@/components/sidebar";
import { useLocalHistory } from "@/hooks/useLocalHistory";

const tabs = [
  { id: "explorer" as const, icon: Files, label: "Explorer" },
  { id: "search" as const, icon: MagnifyingGlass, label: "Search" },
  { id: "git" as const, icon: GitBranch, label: "Git Graph" },
  { id: "git-status" as const, icon: GitDiff, label: "Git Status" },
];

export const DOCK_WIDTH = 48;

// ─── Dock — always visible, fixed width ──────────────────────────────────────

export function SidebarDock({
  panelRef,
}: {
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}) {
  const { sidebarTab, setSidebarTab, sidebarCollapsed } = useLayoutStore();

  const handleToggle = () => {
    const p = panelRef.current;
    if (!p) return;
    if (sidebarCollapsed) p.expand();
    else p.collapse();
  };

  const handleSelectView = (tabId: (typeof tabs)[number]["id"]) => {
    const p = panelRef.current;
    if (sidebarCollapsed && p) {
      p.expand();
    }
    setSidebarTab(tabId);
  };

  return (
    <div className="flex flex-col items-center py-2 w-12 shrink-0 border-r border-border/60 bg-card h-full">
      <div className="flex flex-col gap-0.5 w-full px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === sidebarTab;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-pressed={isActive}
              onClick={() => handleSelectView(tab.id)}
              className={cn(
                "relative flex items-center justify-center rounded-md p-2 transition-all duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              title={tab.label}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-primary" />
              )}
              <tab.icon
                size={20}
                weight={isActive ? "bold" : "regular"}
                className="shrink-0 transition-all duration-150"
              />
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {sidebarCollapsed ? <SidebarSimple size={20} /> : <SidebarIcon size={20} />}
      </button>
    </div>
  );
}

// ─── Content — inside the resizable panel ────────────────────────────────────

export function SidebarContent() {
  const { sidebarTab } = useLayoutStore();
  const { isOpen, activeFilePath, closePanel } = useLocalHistory();

  return (
    <div className="flex h-full min-h-0 flex-col bg-card overflow-hidden" style={{ width: "100%" }}>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sidebarTab === "explorer" && <FileExplorer />}
        {sidebarTab === "search" && (
          <div className="p-3">
            <p className="text-sm text-muted-foreground">Search content</p>
          </div>
        )}
        {sidebarTab === "git" && <GitGraph />}
        {sidebarTab === "git-status" && <GitStatus />}
      </div>
      {activeFilePath && (
        <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
      )}
    </div>
  );
}
