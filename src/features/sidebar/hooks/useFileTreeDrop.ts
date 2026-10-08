import { useState, type DragEvent } from "react";
import { PRAGMA_PATHS_MIME } from "@/shared/lib/pragma-drag";

export function parseDraggedPaths(data: string): string[] {
  try {
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export interface FileTreeDrop {
  over: boolean;
  handlers: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}

/// Accepts explorer drags and moves the dragged paths into `targetDir`.
export function useFileTreeDrop(
  targetDir: string,
  onMove: (paths: string[], targetDir: string) => void,
): FileTreeDrop {
  const [over, setOver] = useState(false);

  return {
    over,
    handlers: {
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATHS_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATHS_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        const paths = parseDraggedPaths(event.dataTransfer.getData(PRAGMA_PATHS_MIME));
        if (paths.length > 0) onMove(paths, targetDir);
      },
    },
  };
}
