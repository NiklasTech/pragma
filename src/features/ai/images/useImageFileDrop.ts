import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import { unlistenQuietly } from "@/shared/lib/unlisten";

interface ImageFile {
  name: string;
  media_type: string;
  data: string;
}

function toFile(image: ImageFile): File {
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], image.name, { type: image.media_type });
}

export function isOver(target: HTMLElement | null, position: { x: number; y: number }): boolean {
  if (!target) return false;
  const ratio = window.devicePixelRatio || 1;
  const element = document.elementFromPoint(position.x / ratio, position.y / ratio);
  return element !== null && target.contains(element);
}

/// Files dropped from the file manager onto `target`; the native drop handler hides them from DOM events.
export function useImageFileDrop(
  target: RefObject<HTMLElement | null>,
  onDrop: (files: File[]) => void,
): boolean {
  const [over, setOver] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (payload.type === "leave") {
            setOver(false);
            return;
          }
          const hovering = isOver(target.current, payload.position);
          if (payload.type !== "drop") {
            setOver(hovering);
            return;
          }
          setOver(false);
          if (!hovering || payload.paths.length === 0) return;

          void Promise.allSettled(
            payload.paths.map((path) => invoke<ImageFile>("read_image_file", { req: { path } })),
          ).then((results) => {
            const files: File[] = [];
            for (const result of results) {
              if (result.status === "fulfilled") files.push(toFile(result.value));
              else toast.error(`Could not attach the file: ${String(result.reason)}`);
            }
            if (files.length > 0) onDropRef.current(files);
          });
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
      void unlistenQuietly(unlisten);
    };
  }, [target]);

  return over;
}
