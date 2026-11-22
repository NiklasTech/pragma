import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type WindowButton = "minimize" | "maximize" | "close";

export interface ButtonLayout {
  left: readonly WindowButton[];
  right: readonly WindowButton[];
}

/** Windows, and any desktop whose layout cannot be read. */
export const DEFAULT_BUTTON_LAYOUT: ButtonLayout = {
  left: [],
  right: ["minimize", "maximize", "close"],
};

let desktopLayout: Promise<ButtonLayout> | null = null;

function readDesktopLayout(): Promise<ButtonLayout> {
  desktopLayout ??= invoke<ButtonLayout>("window_button_layout").catch(() => DEFAULT_BUTTON_LAYOUT);
  return desktopLayout;
}

/// Where the desktop puts the window buttons; only Linux desktops let the user move them.
export function useButtonLayout(followDesktop: boolean): ButtonLayout {
  const [layout, setLayout] = useState(DEFAULT_BUTTON_LAYOUT);
  useEffect(() => {
    if (!followDesktop) return;
    let active = true;
    void readDesktopLayout().then((next) => {
      if (active) setLayout(next);
    });
    return () => {
      active = false;
    };
  }, [followDesktop]);
  return layout;
}
