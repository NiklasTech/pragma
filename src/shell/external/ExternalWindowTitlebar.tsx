import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLineLeft, CornersIn, CornersOut, Minus, X } from "@phosphor-icons/react";
import { TitlebarButton } from "@/shell/chrome/TitlebarButton";

interface ExternalWindowTitlebarProps {
  title: string;
}

export function ExternalWindowTitlebar({ title }: ExternalWindowTitlebarProps) {
  const win = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

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

  const handleDock = useCallback(() => {
    void win.close();
  }, [win]);

  const handleClose = useCallback(() => {
    void win.close();
  }, [win]);

  return (
    <div
      data-tauri-drag-region
      className="relative z-[60] flex h-header shrink-0 select-none items-center justify-between border-b border-border/60 bg-bg-surface"
    >
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center gap-2 px-3 text-ui-sm font-semibold text-fg-default"
      >
        <span className="truncate">{title}</span>
      </div>

      <div className="flex items-center">
        <TitlebarButton
          onClick={handleDock}
          className="h-header w-10"
          title="Dock into main window"
        >
          <ArrowLineLeft size={16} />
        </TitlebarButton>
        <TitlebarButton onClick={handleMinimize} className="h-header w-10" aria-label="Minimize">
          <Minus size={18} weight="bold" />
        </TitlebarButton>
        <TitlebarButton
          onClick={handleToggleMaximize}
          className="h-header w-10"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <CornersIn size={18} weight="bold" />
          ) : (
            <CornersOut size={18} weight="bold" />
          )}
        </TitlebarButton>
        <TitlebarButton
          onClick={handleClose}
          variant="danger"
          className="h-header w-10"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </TitlebarButton>
      </div>
    </div>
  );
}
