import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type WindowMaterial = "sidebar" | "underWindow" | "hud" | "mica" | "acrylic";

export interface WindowTranslucencyStatus {
  supported: boolean;
  materials: WindowMaterial[];
  enabled: boolean;
  material: WindowMaterial;
  /** The windows were created transparent at startup; otherwise a restart applies the change. */
  active: boolean;
}

interface WindowTranslucencyState {
  status: WindowTranslucencyStatus | null;
  load: () => Promise<void>;
  set: (enabled: boolean, material: WindowMaterial) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const useWindowTranslucencyStore = create<WindowTranslucencyState>((set) => ({
  status: null,
  load: async () => {
    if (!isTauri()) return;
    set({ status: await invoke<WindowTranslucencyStatus>("window_translucency_get") });
  },
  set: async (enabled, material) => {
    set({
      status: await invoke<WindowTranslucencyStatus>("window_translucency_set", {
        enabled,
        material,
      }),
    });
  },
}));

/** The desktop shows through only when the windows are transparent and the material is on. */
export function windowShowsThrough(status: WindowTranslucencyStatus | null): boolean {
  return Boolean(status?.supported && status.active && status.enabled);
}
