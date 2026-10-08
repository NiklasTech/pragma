import { invoke } from "@tauri-apps/api/core";

import type { ChatImage } from "@/shared/stores/ai";
import { blobToBase64, encodeCanvas, MAX_IMAGE_BYTES, scaledSize } from "../images/readImage";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/// The frame's area in snapshot pixels, clipped to the snapshot; null when nothing of it is visible.
export function snapshotCrop(
  frame: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewportWidth: number,
  snapshot: { width: number; height: number },
): CropRect | null {
  if (viewportWidth <= 0) return null;
  const scale = snapshot.width / viewportWidth;
  const left = Math.max(0, Math.round(frame.left * scale));
  const top = Math.max(0, Math.round(frame.top * scale));
  const right = Math.min(snapshot.width, Math.round((frame.left + frame.width) * scale));
  const bottom = Math.min(snapshot.height, Math.round((frame.top + frame.height) * scale));
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/// Captures the iframe's area of the window, scaled down to the size the models process.
export async function captureFrame(frame: HTMLIFrameElement): Promise<ChatImage> {
  const buffer = await invoke<ArrayBuffer>("browser_pane_snapshot");
  const bitmap = await createImageBitmap(new Blob([buffer], { type: "image/png" }));
  try {
    const crop = snapshotCrop(frame.getBoundingClientRect(), window.innerWidth, bitmap);
    if (!crop) throw new Error("The browser pane is not visible.");
    const size = scaledSize(crop.width, crop.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the screenshot.");
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    );
    const blob = await encodeCanvas(canvas, "image/png");
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("The screenshot is too large.");
    return { mediaType: blob.type, data: await blobToBase64(blob) };
  } finally {
    bitmap.close();
  }
}
