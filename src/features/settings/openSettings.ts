import { useOverlayStore } from "@/shared/stores/overlays";

import type { Category } from "./components/settings-categories";

/// Opens the settings overlay, on one area when given, scrolled to the setting or section titled `reveal`.
export function openSettings(category?: Category, reveal?: string): void {
  useOverlayStore
    .getState()
    .open("settings", category && reveal ? `${category}#${reveal}` : category);
}
