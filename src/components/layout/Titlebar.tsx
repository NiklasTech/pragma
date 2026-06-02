import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "@phosphor-icons/react";

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  const win = getCurrentWindow();

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
