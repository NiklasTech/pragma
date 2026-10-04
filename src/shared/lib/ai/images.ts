import type { FileUIPart, UIMessage } from "ai";

import type { ChatImage } from "@/shared/stores/ai";

/** An image as the Rust backend expects it. */
export interface BackendImage {
  media_type: string;
  data: string;
}

const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

export function imageToFilePart(image: ChatImage): FileUIPart {
  return {
    type: "file",
    mediaType: image.mediaType,
    url: `data:${image.mediaType};base64,${image.data}`,
  };
}

/** Reads an image file part back into base64 data; other files and remote URLs yield null. */
export function filePartToImage(part: FileUIPart): ChatImage | null {
  const match = DATA_URL_PATTERN.exec(part.url);
  if (!match) return null;
  return { mediaType: match[1].toLowerCase(), data: match[2] };
}

export function getMessageImages(msg: UIMessage): ChatImage[] {
  return msg.parts
    .filter((part): part is FileUIPart => part.type === "file")
    .map(filePartToImage)
    .filter((image): image is ChatImage => image !== null);
}

export function toBackendImage(image: ChatImage): BackendImage {
  return { media_type: image.mediaType, data: image.data };
}
