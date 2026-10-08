import type { ChatImage } from "@/shared/stores/ai";

/** Formats every vision provider and ACP agent accepts. */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_IMAGES_PER_MESSAGE = 8;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Longest edge Anthropic processes without scaling down itself. */
export const MAX_IMAGE_EDGE = 1568;
/** Keeps the base64 payload under the 5 MB per-image limit of the providers. */
export const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

export function isAcceptedImage(file: Pick<File, "type">): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function scaledSize(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read the image."));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Encodes a canvas for the models: PNG when the source is PNG and fits, else JPEG. */
export async function encodeCanvas(canvas: HTMLCanvasElement, sourceType: string): Promise<Blob> {
  // Screenshots stay PNG so text stays sharp; JPEG is the fallback when PNG is too large.
  if (sourceType === "image/png") {
    const png = await canvasToBlob(canvas, "image/png");
    if (png && png.size <= MAX_IMAGE_BYTES) return png;
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!jpeg) throw new Error("Could not process the image.");
  return jpeg;
}

async function downscale(bitmap: ImageBitmap, sourceType: string): Promise<Blob> {
  const size = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the image.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return encodeCanvas(canvas, sourceType);
}

/** Reads an image file, scaling large images down to the size the models process. */
export async function readImageFile(file: File): Promise<ChatImage> {
  if (!isAcceptedImage(file)) {
    throw new Error(`${file.name || "This file"} is not a PNG, JPEG, GIF or WebP image.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name || "The image"} is larger than 20 MB.`);
  }

  const bitmap = await createImageBitmap(file);
  try {
    const size = scaledSize(bitmap.width, bitmap.height);
    const fitsAsIs =
      size.width === bitmap.width && size.height === bitmap.height && file.size <= MAX_IMAGE_BYTES;
    const blob = fitsAsIs ? file : await downscale(bitmap, file.type);
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name || "The image"} is too large to attach.`);
    }
    return { mediaType: blob.type || file.type, data: await blobToBase64(blob) };
  } finally {
    bitmap.close();
  }
}
