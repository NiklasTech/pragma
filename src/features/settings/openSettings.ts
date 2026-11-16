import { useOverlayStore } from "@/shared/stores/overlays";

import type { Category } from "./components/settings-categories";

/// Opens the settings overlay, on one area when given.
export function openSettings(category?: Category): void {
  useOverlayStore.getState().open("settings", category);
}
