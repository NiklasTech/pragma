import { useLayoutStore } from "@/shell/layout/store";
import { cn } from "@/shared/lib/utils";
import {
  Cube,
  Files,
  GitBranch,
  GitDiff,
  MagnifyingGlass,
  SidebarSimple,
  Sidebar as SidebarIcon,
} from "@phosphor-icons/react";
import {
  DockerPanel,
  FileExplorer,
  GitGraph,
  GitStatus,
  LocalHistoryPanel,
} from "@/features/sidebar/components";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";

const tabs = [
  { id: "explorer" as const, icon: Files, label: "Explorer" },
  { id: "search" as const, icon: MagnifyingGlass, label: "Search" },
  { id: "git" as const, icon: GitBranch, label: "Git Graph" },
  { id: "git-status" as const, icon: GitDiff, label: "Git Status" },
  { id: "docker" as const, icon: Cube, label: "Docker" },
];

export const DOCK_WIDTH = 48;

export function SidebarDock() {
  const { sidebar, setSidebarTab, setSidebarCollapsed } = useLayoutStore();

  const handleSelectView = (tabId: (typeof tabs)[number]["id"]) => {
    if (sidebar.tab === tabId && !sidebar.collapsed) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
      setSidebarTab(tabId);
    }
  };

  const isRight = sidebar.position === "right";

  return (
    <div
      className={cn(
        "flex h-full w-12 shrink-0 flex-col items-center border-border/60 bg-card py-2",
        isRight ? "border-l" : "border-r",
      )}
    >
      <div className="flex w-full flex-col gap-0.5 px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === sidebar.tab && !sidebar.collapsed;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-pressed={isActive}
              onClick={() => handleSelectView(tab.id)}
              className={cn(
                "relative flex items-center justify-center rounded-md p-2 outline-none transition-all duration-fast",
                "focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title={tab.label}
            >
              {isActive && (
                <span
                  className={cn(
                    "absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-primary",
                    isRight ? "right-0 rounded-l-full" : "left-0 rounded-r-full",
                  )}
                />
              )}
              <tab.icon
                size={20}
                weight={isActive ? "bold" : "regular"}
                className="shrink-0 transition-all duration-fast"
              />
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setSidebarCollapsed(!sidebar.collapsed)}
        className={cn(
          "rounded-md p-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        title={sidebar.collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {sidebar.collapsed ? <SidebarSimple size={20} /> : <SidebarIcon size={20} />}
      </button>
    </div>
  );
}

export function SidebarContent() {
  const { sidebar } = useLayoutStore();
  const { isOpen, activeFilePath, closePanel } = useLocalHistory();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="min-h-0 flex-1 overflow-hidden">
        {sidebar.tab === "explorer" && <FileExplorer />}
        {sidebar.tab === "search" && (
          <div className="p-3">
            <p className="text-ui-sm text-muted-foreground">Search content</p>
          </div>
        )}
        {sidebar.tab === "git" && <GitGraph />}
        {sidebar.tab === "git-status" && <GitStatus />}
        {sidebar.tab === "docker" && <DockerPanel />}
      </div>
      {activeFilePath && (
        <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
      )}
    </div>
  );
}
