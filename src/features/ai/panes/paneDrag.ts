import { create } from "zustand";

import type { SplitZone } from "./operations";

export const PANE_MIME = "application/x-pragma-pane";

export type DropZone = SplitZone | "center";

export type PaneDropTarget =
  | { groupId: string; kind: "zone"; zone: DropZone }
  | { groupId: string; kind: "tab"; index: number };

interface PaneDragState {
  sourceLeafId: string | null;
  target: PaneDropTarget | null;
  begin: (leafId: string) => void;
  setTarget: (target: PaneDropTarget | null) => void;
  end: () => void;
}

function sameTarget(a: PaneDropTarget | null, b: PaneDropTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.groupId !== b.groupId) return false;
  if (a.kind === "zone" && b.kind === "zone") return a.zone === b.zone;
  if (a.kind === "tab" && b.kind === "tab") return a.index === b.index;
  return false;
}

export const usePaneDragStore = create<PaneDragState>((set, get) => ({
  sourceLeafId: null,
  target: null,
  begin: (leafId) => set({ sourceLeafId: leafId, target: null }),
  setTarget: (target) => {
    if (!sameTarget(get().target, target)) set({ target });
  },
  end: () => set({ sourceLeafId: null, target: null }),
}));

export function resolveDropZone(rect: DOMRect, clientX: number, clientY: number): DropZone {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0.25) return "left";
  if (x > 0.75) return "right";
  if (y < 0.25) return "top";
  if (y > 0.75) return "bottom";
  return "center";
}

/// Index of the first tab whose horizontal midpoint lies right of the pointer.
export function resolveTabIndex(tabs: HTMLElement[], clientX: number): number {
  const index = tabs.findIndex((tab) => {
    const rect = tab.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2;
  });
  return index === -1 ? tabs.length : index;
}

export function isPointerOutside(element: HTMLElement, clientX: number, clientY: number): boolean {
  const rect = element.getBoundingClientRect();
  return (
    clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom
  );
}
