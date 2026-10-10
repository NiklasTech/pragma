import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { isOver } from "@/features/ai/images/useImageFileDrop";
import { PRAGMA_PATH_MIME } from "@/shared/lib/pragma-drag";
import { listenFileDrop } from "@/shared/lib/dragDrop";
import { unlistenQuietly } from "@/shared/lib/unlisten";

interface TerminalFileDropOptions {
  targetRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onPaths: (paths: string[]) => void;
}

export interface TerminalFileDrop {
  over: boolean;
  handlers: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}

// Explorer drags arrive as DOM events; OS drops only through the native webview drop handler.
export function useTerminalFileDrop({
  targetRef,
  enabled,
  onPaths,
}: TerminalFileDropOptions): TerminalFileDrop {
  const [over, setOver] = useState(false);
  const onPathsRef = useRef(onPaths);
  onPathsRef.current = onPaths;

  useEffect(() => {
    if (!enabled) return;
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await listenFileDrop((payload) => {
          if (payload.type === "leave") {
            setOver(false);
            return;
          }
          const hovering = isOver(targetRef.current, payload.position);
          if (payload.type !== "drop") {
            setOver(hovering);
            return;
          }
          setOver(false);
          if (hovering && payload.paths.length > 0) onPathsRef.current(payload.paths);
        });
      } catch {
        return;
      }
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      setOver(false);
      void unlistenQuietly(unlisten);
    };
  }, [enabled, targetRef]);

  return {
    over,
    handlers: {
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATH_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATH_MIME)) return;
        event.preventDefault();
        setOver(false);
        const path = event.dataTransfer.getData(PRAGMA_PATH_MIME);
        if (path) onPathsRef.current([path]);
      },
    },
  };
}
