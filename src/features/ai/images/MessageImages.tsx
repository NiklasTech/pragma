import type { UIMessage } from "ai";

import { getMessageImages, imageToFilePart } from "@/shared/lib/ai/images";

/// Images the user attached to a message, shown above its text.
export function MessageImages({ message }: { message: UIMessage }) {
  const images = getMessageImages(message);
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        <img
          key={index}
          src={imageToFilePart(image).url}
          alt={`Attached image ${index + 1}`}
          className="max-h-40 max-w-full rounded-lg border border-border/60 object-contain"
        />
      ))}
    </div>
  );
}
