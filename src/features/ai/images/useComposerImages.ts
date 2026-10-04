import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { generateId } from "@/shared/lib/ai/id";
import type { ChatImage } from "@/shared/stores/ai";

import { MAX_IMAGES_PER_MESSAGE, readImageFile } from "./readImage";

export interface ComposerImage extends ChatImage {
  id: string;
  name: string;
}

export interface ComposerImages {
  images: ComposerImage[];
  addFiles: (files: File[]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/// Images attached to the next message, read and scaled down as they are added.
export function useComposerImages(): ComposerImages {
  const [images, setImages] = useState<ComposerImage[]>([]);
  const attachedRef = useRef(0);
  attachedRef.current = images.length;
  // Files still being read count against the limit too.
  const pendingRef = useRef(0);

  const addFiles = useCallback((files: File[]) => {
    const room = MAX_IMAGES_PER_MESSAGE - attachedRef.current - pendingRef.current;
    if (files.length > room) {
      toast.error(`A message can carry at most ${MAX_IMAGES_PER_MESSAGE} images.`);
    }
    const accepted = files.slice(0, Math.max(0, room));
    pendingRef.current += accepted.length;

    for (const file of accepted) {
      readImageFile(file)
        .then((image) => {
          setImages((current) => [
            ...current,
            { ...image, id: generateId(), name: file.name || "Pasted image" },
          ]);
        })
        .catch((err: unknown) => {
          toast.error(
            err instanceof Error ? err.message : `Could not attach the image: ${String(err)}`,
          );
        })
        .finally(() => {
          pendingRef.current -= 1;
        });
    }
  }, []);

  const remove = useCallback((id: string) => {
    setImages((current) => current.filter((image) => image.id !== id));
  }, []);

  const clear = useCallback(() => setImages([]), []);

  return { images, addFiles, remove, clear };
}
