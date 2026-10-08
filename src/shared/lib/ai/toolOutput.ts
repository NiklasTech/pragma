import type { ChatImage } from "@/shared/stores/ai";

/** A tool result that carries images next to its text, for example a browser screenshot. */
export interface ToolImageOutput {
  text: string;
  images: ChatImage[];
}

export type ToolOutput = string | ToolImageOutput;

function isChatImage(value: unknown): value is ChatImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Record<string, unknown>;
  return typeof image.mediaType === "string" && typeof image.data === "string";
}

export function isToolImageOutput(value: unknown): value is ToolImageOutput {
  if (typeof value !== "object" || value === null) return false;
  const output = value as Record<string, unknown>;
  return (
    typeof output.text === "string" &&
    Array.isArray(output.images) &&
    output.images.every(isChatImage)
  );
}

/** The text of a tool output, without the data of its images. */
export function toolOutputText(output: unknown): string {
  if (typeof output === "string") return output;
  if (isToolImageOutput(output)) return output.text;
  return JSON.stringify(output ?? "");
}

export function toolOutputImages(output: unknown): ChatImage[] {
  return isToolImageOutput(output) ? output.images : [];
}
