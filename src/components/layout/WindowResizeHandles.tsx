import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";

type ResizeEdge =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

const EDGE_MAP: Record<ResizeEdge, string> = {
  north: "top-0 left-2 right-2 h-1 cursor-ns-resize",
  south: "bottom-0 left-2 right-2 h-1 cursor-ns-resize",
  east: "right-0 top-2 bottom-2 w-1 cursor-ew-resize",
  west: "left-0 top-2 bottom-2 w-1 cursor-ew-resize",
  "north-east": "top-0 right-0 w-2 h-2 cursor-ne-resize",
  "north-west": "top-0 left-0 w-2 h-2 cursor-nw-resize",
  "south-east": "bottom-0 right-0 w-2 h-2 cursor-se-resize",
  "south-west": "bottom-0 left-0 w-2 h-2 cursor-sw-resize",
};

const DIRECTION_MAP: Record<ResizeEdge, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
  "north-east": "NorthEast",
  "north-west": "NorthWest",
  "south-east": "SouthEast",
  "south-west": "SouthWest",
};

function ResizeHandle({ edge }: { edge: ResizeEdge }) {
  const win = getCurrentWindow();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void win.startResizeDragging(
        DIRECTION_MAP[edge] as
          | "East"
          | "North"
          | "NorthEast"
          | "NorthWest"
          | "South"
          | "SouthEast"
          | "SouthWest"
          | "West",
      );
    },
    [win, edge],
  );

  return (
    <div
      className={cn("fixed z-[9999]", EDGE_MAP[edge])}
      onMouseDown={handleMouseDown}
      aria-hidden="true"
    />
  );
}

/**
 * Invisible resize handles around the window edges.
 * Required when `decorations: false` is set in tauri.conf.json,
 * because the OS no longer provides native resize borders.
 */
export function WindowResizeHandles() {
  return (
    <>
      <ResizeHandle edge="north" />
      <ResizeHandle edge="south" />
      <ResizeHandle edge="east" />
      <ResizeHandle edge="west" />
      <ResizeHandle edge="north-east" />
      <ResizeHandle edge="north-west" />
      <ResizeHandle edge="south-east" />
      <ResizeHandle edge="south-west" />
    </>
  );
}
