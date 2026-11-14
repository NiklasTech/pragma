import { create } from "zustand";
import type { ShortcutActionId } from "@/shared/lib/shortcuts";

/** Everything beyond the strip and the panes opens as one of these overlays. */
export const OVERLAY_IDS = [
  "overview",
  "peek",
  "quickStart",
  "goTo",
  "review",
  "spaces",
  "settings",
  "git",
] as const;

export type OverlayId = (typeof OVERLAY_IDS)[number];

/** The shortcut that toggles each overlay; overlays without one open by click only. */
export const OVERLAY_SHORTCUTS: Partial<Record<OverlayId, ShortcutActionId>> = {
  goTo: "file.goToFile",
};

interface OverlayState {
  /** At most one overlay is open; opening another replaces it. */
  active: OverlayId | null;
  /** What the open overlay shows, for example the session an agent peek belongs to. */
  target: string | null;
  open: (id: OverlayId, target?: string) => void;
  /** Closes the overlay; with an id, only when that overlay is the open one. */
  close: (id?: OverlayId) => void;
  toggle: (id: OverlayId) => void;
}

export const useOverlayStore = create<OverlayState>()((set, get) => ({
  active: null,
  target: null,
  open: (id, target) => set({ active: id, target: target ?? null }),
  close: (id) => {
    if (id && get().active !== id) return;
    set({ active: null, target: null });
  },
  toggle: (id) => {
    if (get().active === id) get().close();
    else get().open(id);
  },
}));

export function useOverlayOpen(id: OverlayId): boolean {
  return useOverlayStore((state) => state.active === id);
}
