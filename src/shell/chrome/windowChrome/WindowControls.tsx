import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CopySimple, Minus, Square, X, type Icon } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { cn } from "@/shared/lib/utils";

import type { WindowButton } from "./useButtonLayout";

/** Windows draws flush caption buttons; GNOME and KDE draw round ones. */
export type WindowControlsLook = "caption" | "round";

function useIsMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    void win.isMaximized().then(setMaximized);
    return () => {
      void unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, []);
  return maximized;
}

interface ButtonSpec {
  label: string;
  icon: Icon;
  run: () => void;
}

function buttonSpec(button: WindowButton, maximized: boolean): ButtonSpec {
  const win = getCurrentWindow();
  if (button === "minimize") {
    return { label: "Minimize", icon: Minus, run: () => void win.minimize() };
  }
  if (button === "maximize") {
    return {
      label: maximized ? "Restore" : "Maximize",
      icon: maximized ? CopySimple : Square,
      run: () => void win.toggleMaximize(),
    };
  }
  return { label: "Close", icon: X, run: () => void win.close() };
}

/// The minimize, maximize and close buttons of a window without native decorations.
export function WindowControls({
  buttons,
  look,
  className,
}: {
  buttons: readonly WindowButton[];
  look: WindowControlsLook;
  className?: string;
}) {
  const maximized = useIsMaximized();
  if (buttons.length === 0) return null;

  return (
    <div
      className={cn(
        "flex shrink-0",
        look === "caption" ? "self-stretch" : "items-center gap-2.5",
        className,
      )}
    >
      {buttons.map((button) => {
        const { label, icon: IconComponent, run } = buttonSpec(button, maximized);
        return (
          <Button
            key={button}
            variant="ghost"
            aria-label={label}
            title={label}
            onClick={run}
            className={cn(
              look === "caption"
                ? "h-full w-[46px] rounded-none text-fg-default"
                : "size-6 rounded-full bg-control text-fg-default hover:bg-control-hover",
              look === "caption" &&
                button === "close" &&
                "hover:bg-status-error hover:text-fg-inverse",
            )}
          >
            <IconComponent
              size={look === "caption" ? 14 : 12}
              weight={look === "caption" ? "light" : "bold"}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}
