import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { TauriEvent, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";

import { unlistenQuietly } from "./unlisten";

interface NativeDragPayload {
  paths?: string[];
  position: { x: number; y: number };
}

/// Like `onDragDropEvent`, whose unlisten fires four async unlistens without awaiting them, so
/// an early unmount surfaced their rejections as unhandled. This one retries and awaits each.
export async function listenFileDrop(
  handler: (payload: DragDropEvent) => void,
): Promise<UnlistenFn> {
  const webview = getCurrentWebview();
  const unlistens = await Promise.all([
    webview.listen<NativeDragPayload>(TauriEvent.DRAG_ENTER, ({ payload }) =>
      handler({
        type: "enter",
        paths: payload.paths ?? [],
        position: new PhysicalPosition(payload.position),
      }),
    ),
    webview.listen<NativeDragPayload>(TauriEvent.DRAG_OVER, ({ payload }) =>
      handler({ type: "over", position: new PhysicalPosition(payload.position) }),
    ),
    webview.listen<NativeDragPayload>(TauriEvent.DRAG_DROP, ({ payload }) =>
      handler({
        type: "drop",
        paths: payload.paths ?? [],
        position: new PhysicalPosition(payload.position),
      }),
    ),
    webview.listen(TauriEvent.DRAG_LEAVE, () => handler({ type: "leave" })),
  ]);
  return async () => {
    await Promise.all(unlistens.map((unlisten) => unlistenQuietly(unlisten)));
  };
}
