import type { Icon } from "@phosphor-icons/react";
import {
  Bug,
  CaretUpDown,
  Cube,
  Files,
  GitBranch,
  GitDiff,
  MagnifyingGlass,
  PuzzlePiece,
  SidebarSimple,
  Terminal,
} from "@phosphor-icons/react";

import { useLayoutStore } from "@/shell/layout/store";
import type { SidebarTab } from "@/shell/layout/tree/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { cn } from "@/shared/lib/utils";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import {
  DockerPanel,
  FileExplorer,
  GitGraph,
  GitStatus,
  LocalHistoryPanel,
  ProcessManagerPanel,
  SearchPanel,
} from "@/features/sidebar/components";
import { DebugPanel } from "@/features/debug/components/DebugPanel";
import { ExtensionSidebarPanel } from "@/features/extensions/components/ExtensionSidebarPanel";

interface SidebarView {
  id: SidebarTab;
  label: string;
  icon: Icon;
}

const primaryViews: SidebarView[] = [
  { id: "explorer", label: "Files", icon: Files },
  { id: "search", label: "Search", icon: MagnifyingGlass },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "git-status", label: "Status", icon: GitDiff },
];

const moreViews: SidebarView[] = [
  { id: "debug", label: "Debug", icon: Bug },
  { id: "docker", label: "Docker", icon: Cube },
  { id: "processes", label: "Processes", icon: Terminal },
  { id: "extensions", label: "Extensions", icon: PuzzlePiece },
];

function SidebarViewContent({ tab }: { tab: SidebarTab }) {
  switch (tab) {
    case "search":
      return <SearchPanel />;
    case "git":
      return <GitGraph />;
    case "git-status":
      return <GitStatus />;
    case "docker":
      return <DockerPanel />;
    case "processes":
      return <ProcessManagerPanel />;
    case "debug":
      return <DebugPanel />;
    case "extensions":
      return <ExtensionSidebarPanel />;
    default:
      return <FileExplorer />;
  }
}

function ViewTab({
  view,
  isActive,
  onSelect,
}: {
  view: SidebarView;
  isActive: boolean;
  onSelect: (tab: SidebarTab) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onSelect(view.id)}
      title={view.label}
      className={cn(
        "flex h-6 min-w-0 flex-1 items-center justify-center gap-1 rounded-sm px-1 text-ui-2xs font-medium transition-colors",
        isActive
          ? "bg-bg-elevated text-fg-default"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      <view.icon size={13} weight={isActive ? "duotone" : "regular"} className="shrink-0" />
      <span className="hidden truncate @min-[250px]:inline">{view.label}</span>
    </button>
  );
}

function MoreViewsMenu({
  activeTab,
  onSelect,
}: {
  activeTab: SidebarTab;
  onSelect: (tab: SidebarTab) => void;
}) {
  const isActive = moreViews.some((view) => view.id === activeTab);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="More views"
            title="More views"
            className={cn(
              "flex h-6 shrink-0 items-center justify-center rounded-sm px-1 transition-colors",
              isActive
                ? "bg-bg-elevated text-fg-default"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <CaretUpDown size={13} className="shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent side="top" align="start" className="min-w-[160px]">
        {moreViews.map((view) => (
          <DropdownMenuItem key={view.id} onClick={() => onSelect(view.id)}>
            <view.icon size={14} />
            {view.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarCollapsedStrip() {
  const { sidebar, setSidebarTab, setSidebarCollapsed } = useLayoutStore();
  const isRight = sidebar.position === "right";

  const handleSelect = (tab: SidebarTab) => {
    setSidebarTab(tab);
    setSidebarCollapsed(false);
  };

  return (
    <div
      className={cn(
        "flex h-full w-[var(--width-sidebar-collapsed)] shrink-0 flex-col items-center gap-1 py-2",
        isRight ? "border-l border-border/60" : "border-r border-border/60",
      )}
    >
      <button
        type="button"
        onClick={() => setSidebarCollapsed(false)}
        aria-label="Expand sidebar"
        title="Expand Sidebar (Ctrl+B)"
        className="flex size-7 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
      >
        <SidebarSimple size={15} />
      </button>

      <div className="flex flex-col items-center gap-0.5">
        {primaryViews.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-label={view.label}
            aria-pressed={sidebar.tab === view.id}
            onClick={() => handleSelect(view.id)}
            title={view.label}
            className={cn(
              "flex size-7 items-center justify-center rounded-sm transition-colors",
              sidebar.tab === view.id
                ? "bg-bg-elevated text-fg-default"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <view.icon size={15} weight={sidebar.tab === view.id ? "duotone" : "regular"} />
          </button>
        ))}
        <MoreViewsMenu activeTab={sidebar.tab} onSelect={handleSelect} />
      </div>
    </div>
  );
}

export function SidebarContent() {
  const { sidebar, setSidebarCollapsed, setSidebarTab } = useLayoutStore();
  const { isOpen, activeFilePath, closePanel } = useLocalHistory();
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  if (sidebar.collapsed) {
    return <SidebarCollapsedStrip />;
  }

  const workspaceName = getWorkspaceName(rootPath) || "No folder";
  const isRight = sidebar.position === "right";

  return (
    <div
      className={cn(
        "@container flex h-full min-h-0 flex-col bg-bg-surface",
        isRight ? "border-l border-border/60" : "border-r border-border/60",
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <span
          className="min-w-0 flex-1 truncate text-ui-xs font-semibold text-fg-default"
          title={rootPath ?? undefined}
        >
          {workspaceName}
        </span>
        <button
          type="button"
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse Sidebar (Ctrl+B)"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <SidebarSimple size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <SidebarViewContent tab={sidebar.tab} />
      </div>

      {activeFilePath && (
        <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
      )}

      <div className="flex shrink-0 items-center gap-0.5 border-t border-border/60 px-1 py-1">
        {primaryViews.map((view) => (
          <ViewTab
            key={view.id}
            view={view}
            isActive={sidebar.tab === view.id}
            onSelect={setSidebarTab}
          />
        ))}
        <MoreViewsMenu activeTab={sidebar.tab} onSelect={setSidebarTab} />
      </div>
    </div>
  );
}
