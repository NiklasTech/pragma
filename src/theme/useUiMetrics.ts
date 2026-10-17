import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getIsMac } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  applyUiMetrics,
  scaleUiSize,
  stepUiScale,
  uiHeaderHeight,
  UI_SCALE_DEFAULT,
} from "./uiMetrics";

// The editor and the terminal handle these keys themselves for their own font size.
const OWN_ZOOM_SELECTOR = ".cm-editor, .xterm";

export type UiZoomAction = "in" | "out" | "reset";

export function uiZoomAction(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">,
): UiZoomAction | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  if (event.key === "+" || event.key === "=") return "in";
  if (event.key === "-") return "out";
  if (event.key === "0") return "reset";
  return null;
}

/** Applies density, UI scale and UI font, and handles the UI zoom shortcuts. */
export function useUiMetrics(): void {
  const appearance = useSettingsStore((s) => s.appearance);

  const headerHeight = uiHeaderHeight(appearance);

  useEffect(() => {
    applyUiMetrics(appearance);
  }, [appearance]);

  // The native traffic lights are centered in the header, so they follow its height.
  useEffect(() => {
    if (!getIsMac()) return;
    void invoke("set_window_header_height", { height: headerHeight }).catch(() => {});
  }, [headerHeight]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = uiZoomAction(event);
      if (!action) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(OWN_ZOOM_SELECTOR)) return;

      event.preventDefault();
      const settings = useSettingsStore.getState();
      const current = settings.appearance.uiScale;
      const uiScale =
        action === "reset" ? UI_SCALE_DEFAULT : stepUiScale(current, action === "in" ? 1 : -1);
      settings.setAppearanceSettings({ uiScale });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Scales a design-time row or bar height by density and UI scale, for virtualized lists. */
export function useUiSize(): (px: number) => number {
  const appearance = useSettingsStore((s) => s.appearance);
  return useCallback((px: number) => scaleUiSize(px, appearance), [appearance]);
}
