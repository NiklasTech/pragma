import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FloppyDisk, FolderOpen, Minus, Square, X } from "@phosphor-icons/react";
import { useOpenFile } from "@/hooks/useOpenFile";
import { useSaveFile } from "@/hooks/useSaveFile";
import { useEditorStore } from "@/stores/editor";
import { RunConfigWidget } from "@/components/run-config";

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const openFile = useOpenFile();
  const saveFile = useSaveFile();
  const { tabs, activeTabId } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canSave = activeTab?.kind === "file" ? activeTab.isModified : false;

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
      className="flex h-9 shrink-0 items-center justify-between select-none bg-card border-b border-border/60"
    >
      <div className="flex items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" className="h-4 w-4" />
        <span className="text-xs font-medium text-muted-foreground">Pragma</span>
        <button
          type="button"
          onClick={openFile}
          className="ml-2 flex h-6 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Open File"
        >
          <FolderOpen size={14} />
          <span>Open</span>
        </button>
        <button
          type="button"
          onClick={saveFile}
          disabled={!canSave}
          className="flex h-6 items-center gap-1.5 rounded px-2 text-xs transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground"
          title="Save File"
        >
          <FloppyDisk size={14} />
          <span>Save</span>
        </button>

        <div className="mx-1 h-4 w-px bg-border" />
        <RunConfigWidget />
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex items-center">
        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Minimize"
        >
          <Minus size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square size={12} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
          aria-label="Close"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
