import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  FloppyDisk,
  FolderOpen,
  Gear,
  Minus,
  CornersOut,
  CornersIn,
  X,
} from "@phosphor-icons/react";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { RunConfigWidget } from "@/features/run-config/components";

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const openFile = useOpenFile();
  const saveFile = useSaveFile();
  const { tabs, activeTabId } = useEditorStore();
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const isMac = getIsMac();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canSave = activeTab?.kind === "file" ? activeTab.isModified : false;

  const { addFloatingPanel } = useLayoutStore();

  useEffect(() => {
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });
    void win.isMaximized().then(setIsMaximized);
    return () => {
      void unlisten.then((f) => f());
    };
  }, [win]);

  const handleMinimize = useCallback(() => {
    void win.minimize();
  }, [win]);

  const handleToggleMaximize = useCallback(() => {
    void win.toggleMaximize();
  }, [win]);

  const handleClose = useCallback(() => {
    void win.close();
  }, [win]);

  return (
    <div
      data-tauri-drag-region
      className="flex h-header shrink-0 items-center justify-between select-none border-b border-border/60 bg-bg-surface"
    >
      <div className="flex items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" className="h-5 w-5" />
        <span className="text-ui-xs font-semibold text-fg-default">Pragma</span>

        <button
          type="button"
          onClick={openFile}
          className="flex h-8 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          title={`Open File (${formatShortcut(shortcuts["file.open"], isMac)})`}
        >
          <FolderOpen size={16} />
        </button>

        <button
          type="button"
          onClick={saveFile}
          disabled={!canSave}
          className="flex h-8 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:cursor-not-allowed disabled:opacity-40"
          title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
        >
          <FloppyDisk size={16} />
        </button>

        <div className="mx-1 h-4 w-px bg-border/60" />
        <RunConfigWidget />
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex items-center">
        <div className="flex items-center border-l border-border/40">
          <button
            type="button"
            onClick={() => addFloatingPanel("settings")}
            className="flex h-header w-10 items-center justify-center text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
          >
            <Gear size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          aria-label="Minimize"
        >
          <Minus size={18} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <CornersIn size={18} weight="bold" />
          ) : (
            <CornersOut size={18} weight="bold" />
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-status-error hover:text-fg-inverse"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
