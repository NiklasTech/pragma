import { useCallback, useRef } from "react";
import { create } from "zustand";

/// Pointer travel before a press on a pane header becomes a drag.
const DRAG_THRESHOLD_PX = 5;

interface PaneDragState {
  sourceLeafId: string | null;
  targetLeafId: string | null;
  begin: (leafId: string) => void;
  setTarget: (leafId: string | null) => void;
  end: () => void;
}

export const usePaneDragStore = create<PaneDragState>((set, get) => ({
  sourceLeafId: null,
  targetLeafId: null,
  begin: (leafId) => set({ sourceLeafId: leafId, targetLeafId: null }),
  setTarget: (leafId) => {
    if (get().targetLeafId !== leafId) set({ targetLeafId: leafId });
  },
  end: () => set({ sourceLeafId: null, targetLeafId: null }),
}));

/// The pane leaf under the pointer, read from the `data-pane-leaf` attribute of its card.
export function paneLeafAt(clientX: number, clientY: number): string | null {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest<HTMLElement>("[data-pane-leaf]")?.dataset.paneLeaf ?? null;
}

/// Pointer handlers that drag a pane by its header and drop it onto another pane.
export function usePaneHeaderDrag(leafId: string, onDrop: (targetLeafId: string) => void) {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // Portaled menus and dialogs bubble through React but sit outside the header in the DOM.
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    if (!event.currentTarget.contains(event.target)) return;
    if (event.target.closest("button, [data-pane-actions]")) return;
    startRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    // Capture keeps the moves coming while the pointer crosses terminals and browser frames.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const drag = usePaneDragStore.getState();
      if (drag.sourceLeafId !== leafId) {
        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (distance < DRAG_THRESHOLD_PX) return;
        drag.begin(leafId);
      }
      const target = paneLeafAt(event.clientX, event.clientY);
      usePaneDragStore.getState().setTarget(target === leafId ? null : target);
    },
    [leafId],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>, drop: boolean) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      startRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const { sourceLeafId, targetLeafId, end } = usePaneDragStore.getState();
      end();
      if (drop && sourceLeafId === leafId && targetLeafId) onDrop(targetLeafId);
    },
    [leafId, onDrop],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => finish(event, true),
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => finish(event, false),
  };
}
