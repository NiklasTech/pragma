import { useLayoutStore } from "@/shell/layout/store";
import { cn } from "@/shared/lib/utils";
import {
  Cube,
  Files,
  GitBranch,
  GitDiff,
  MagnifyingGlass,
  SidebarSimple,
  Terminal,
} from "@phosphor-icons/react";
import {
  DockerPanel,
  FileExplorer,
  GitGraph,
  GitStatus,
  LocalHistoryPanel,
  ProcessManagerPanel,
  SearchPanel,
} from "@/features/sidebar/components";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";

const tabs = [
  { id: "explorer" as const, icon: Files, label: "Explorer" },
  { id: "search" as const, icon: MagnifyingGlass, label: "Search" },
  { id: "git" as const, icon: GitBranch, label: "Git Graph" },
  { id: "git-status" as const, icon: GitDiff, label: "Git Status" },
  { id: "docker" as const, icon: Cube, label: "Docker" },
  { id: "processes" as const, icon: Terminal, label: "Processes" },
];

export const DOCK_WIDTH = 40;

function DockTabButton({
  tab,
  index,
  isActive,
  onSelect,
}: {
  tab: (typeof tabs)[number];
  index: number;
  isActive: boolean;
  onSelect: (tabId: (typeof tabs)[number]["id"]) => void;
}) {
  return (
    <button
      type="button"
      aria-label={tab.label}
      aria-pressed={isActive}
      onClick={() => onSelect(tab.id)}
      className={cn(
        "relative flex size-8 items-center justify-center rounded-md outline-none transition-all duration-fast",
        isActive
          ? "bg-accent-subtle text-fg-default"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
      )}
      title={`${tab.label} (Ctrl+Shift+${index + 1})`}
    >
      <tab.icon
        size={18}
        weight={isActive ? "duotone" : "regular"}
        className="shrink-0 transition-all duration-fast"
      />
    </button>
  );
}

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
        "flex h-full w-[--width-sidebar-collapsed] shrink-0 flex-col py-2",
        isRight ? "pr-2" : "pl-2",
      )}
    >
      <div className="flex w-full flex-1 flex-col items-center rounded-xl border border-border bg-bg-surface py-2">
        <div className="flex w-full flex-col gap-1 px-1">
          <div className="flex w-full flex-col gap-1">
            {tabs.slice(0, 2).map((tab, index) => (
              <DockTabButton
                key={tab.id}
                tab={tab}
                index={index}
                isActive={tab.id === sidebar.tab && !sidebar.collapsed}
                onSelect={handleSelectView}
              />
            ))}
          </div>

          <div className="my-1 mx-2 h-px bg-border/30" />

          <div className="flex w-full flex-col gap-1">
            {tabs.slice(2, 4).map((tab, index) => (
              <DockTabButton
                key={tab.id}
                tab={tab}
                index={index + 2}
                isActive={tab.id === sidebar.tab && !sidebar.collapsed}
                onSelect={handleSelectView}
              />
            ))}
          </div>

          <div className="my-1 mx-2 h-px bg-border/30" />

          <div className="flex w-full flex-col gap-1">
            {tabs.slice(4).map((tab, index) => (
              <DockTabButton
                key={tab.id}
                tab={tab}
                index={index + 4}
                isActive={tab.id === sidebar.tab && !sidebar.collapsed}
                onSelect={handleSelectView}
              />
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebar.collapsed)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md outline-none",
            "text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-muted",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          title={sidebar.collapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
        >
          <SidebarSimple size={18} />
        </button>
      </div>
    </div>
  );
}

export function SidebarContent() {
  const { sidebar } = useLayoutStore();
  const { isOpen, activeFilePath, closePanel } = useLocalHistory();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col py-2 pr-1 pl-1">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-bg-surface">
        <div className="min-h-0 flex-1 overflow-hidden">
          {sidebar.tab === "explorer" && <FileExplorer />}
          {sidebar.tab === "search" && <SearchPanel />}
          {sidebar.tab === "git" && <GitGraph />}
          {sidebar.tab === "git-status" && <GitStatus />}
          {sidebar.tab === "docker" && <DockerPanel />}
          {sidebar.tab === "processes" && <ProcessManagerPanel />}
        </div>
        {activeFilePath && (
          <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
        )}
      </div>
    </div>
  );
}
