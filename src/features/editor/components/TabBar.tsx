import { useState, useCallback, useRef } from "react";
import { FolderSimple, GitCommit, GitDiff, SquareSplitHorizontal, X } from "@phosphor-icons/react";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { useEditorStore } from "@/shared/stores/editor";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileHistoryDialog } from "@/features/sidebar/lib/gitDialogs";
import { cn } from "@/shared/lib/utils";
import { handleTabListKeyDown } from "@/shared/lib/tabListKeys";
import { otherTabRepository } from "@/features/editor/tabRepository";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { useLayoutStore } from "@/shell/layout/store";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";
import { EditorTabActions } from "./EditorTabActions";
import { useActiveTabInView } from "./useActiveTabInView";
import { middleClickToClose } from "@/shared/lib/middleClick";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";
import { editorTabMenu } from "./editorTabMenu";

/** The active file's folder relative to the open folder, as the tab row shows it. */
function folderOf(path: string, root: string | null): string | null {
  const relative = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
  const slash = relative.lastIndexOf("/");
  return slash > 0 ? relative.slice(0, slash) : null;
}

interface TabBarProps {
  panelId?: string;
  onClosePanel?: () => void;
}

export function TabBar({ panelId, onClosePanel }: TabBarProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.getPanelActiveTabId(panelId ?? null));
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setPanelActiveTab = useEditorStore((s) => s.setPanelActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const reorderTabs = useEditorStore((s) => s.reorderTabs);
  const repositories = useOpenRepositoriesStore((s) => s.paths);
  const activeRoot = useFileExplorerStore((s) => s.rootPath);
  const filesOpen = useLayoutStore(
    (s) => !s.sidebar.collapsed && s.sidebar.position !== "hidden" && s.sidebar.tab === "explorer",
  );
  const filesBinding = useSettingsStore((s) => s.shortcuts["view.toggleSidebar"]);
  const filesShortcut = filesBinding ? formatShortcut(filesBinding, getIsMac()) : undefined;
  const closeTabBinding = useSettingsStore((state) => state.shortcuts["file.closeTab"]);
  const closeTabShortcut = closeTabBinding
    ? formatShortcut(closeTabBinding, getIsMac())
    : undefined;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useActiveTabInView(listRef, activeTabId, tabs.length);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedIndex !== null) {
        reorderTabs(draggedIndex, targetIndex);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, reorderTabs],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      closeTab(tabId);
    },
    [closeTab],
  );

  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activePath = activeTab ? folderOf(activeTab.path, activeRoot) : null;

  return (
    <div className="@container flex h-10.5 min-w-0 shrink-0 items-center">
      {panelId && (
        <IconButton
          icon={FolderSimple}
          label="Files"
          shortcut={filesShortcut}
          weight={filesOpen ? "fill" : "regular"}
          className="ml-1.5 shrink-0"
          onClick={() => {
            const layout = useLayoutStore.getState();
            if (layout.sidebar.tab !== "explorer") layout.setSidebarTab("explorer");
            if (layout.sidebar.tab === "explorer" || layout.sidebar.collapsed)
              layout.toggleSidebar();
          }}
        />
      )}
      <div
        ref={listRef}
        role="tablist"
        aria-label="Open files"
        onKeyDown={handleTabListKeyDown}
        className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1.5"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id;
          // One tab stop per bar: the active tab, or the first when none of these is active.
          const isTabStop = isActive || (!activeTab && index === 0);
          const isDropTarget = dragOverIndex === index;
          const fileIconPath =
            tab.kind === "file" || tab.kind === "preview" ? getFileIconPath(tab.name) : null;
          const repository = otherTabRepository(tab.path, repositories, activeRoot);

          const handleActivate = () => {
            if (panelId) {
              setPanelActiveTab(panelId, tab.id);
            } else {
              setActiveTab(tab.id);
            }
          };

          const middleClick = middleClickToClose(() => closeTab(tab.id));

          return (
            <ActionContextMenu
              key={tab.id}
              menu={() =>
                editorTabMenu(tab, tabs, {
                  close: closeTab,
                  closeShortcut: closeTabShortcut,
                  showHistory: (path) => useFileHistoryDialog.getState().show(path),
                  copyPath: (path) => void copyToClipboard(path),
                  rootPath: activeRoot,
                })
              }
            >
              <div
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => handleActivate()}
                {...middleClick}
                title={repository ? `${tab.name} (${getWorkspaceName(repository)})` : tab.name}
                role="tab"
                aria-selected={isActive}
                tabIndex={isTabStop ? 0 : -1}
                data-active={isActive}
                className={cn(
                  "pragma-pill-tab group/tab relative max-w-[220px] cursor-pointer",
                  isDropTarget && draggedIndex !== index && "bg-accent-subtle",
                )}
              >
                {tab.kind === "diff" ? (
                  <GitDiff size={14} className="shrink-0 text-status-success" />
                ) : tab.kind === "history" ? (
                  <GitCommit size={14} className="shrink-0 text-primary" />
                ) : (
                  <img src={fileIconPath ?? undefined} alt="" className="size-3.5 shrink-0" />
                )}
                {repository && <RepositoryColorDot path={repository} className="size-1.5" />}
                <span className="min-w-0 flex-1 truncate font-mono text-ui-xs">{tab.name}</span>
                {tab.kind === "file" && tab.isModified && (
                  <span className="size-1.5 shrink-0 rounded-full bg-fg-muted group-hover/tab:hidden" />
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCloseTab(tab.id)}
                  className={cn(
                    "size-4 text-fg-subtle",
                    isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
                    tab.kind === "file" && tab.isModified && "hidden group-hover/tab:block",
                  )}
                  aria-label={`Close ${tab.name}`}
                  tabIndex={isActive ? 0 : -1}
                >
                  <X size={12} />
                </Button>
              </div>
            </ActionContextMenu>
          );
        })}
      </div>
      <span className="flex shrink-0 items-center gap-0.5 pr-1.5 pl-2">
        {activePath && (
          <span
            className="hidden max-w-[260px] truncate pr-1.5 text-ui-2xs text-fg-subtle @lg:inline"
            title={activePath}
          >
            {activePath}
          </span>
        )}
        <EditorTabActions panelId={panelId} />
        {panelId && (
          <IconButton
            icon={SquareSplitHorizontal}
            label="Split editor"
            onClick={() => useLayoutStore.getState().splitPanel(panelId, "horizontal", "editor")}
          />
        )}
      </span>
      {onClosePanel && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="mr-1.5 shrink-0 text-fg-subtle hover:text-fg-default"
          onClick={onClosePanel}
          title="Close editor group"
          aria-label="Close editor group"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
