import { X } from "@phosphor-icons/react";

import { imageToFilePart } from "@/shared/lib/ai/images";

import type { ComposerImage } from "./useComposerImages";

interface ComposerImagesProps {
  images: ComposerImage[];
  onRemove: (id: string) => void;
  /** Shown when the selected engine cannot take the attached images. */
  unsupportedReason: string | null;
}

export function ComposerImages({ images, onRemove, unsupportedReason }: ComposerImagesProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-3.5 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {images.map((image) => (
          <span
            key={image.id}
            title={image.name}
            className="flex max-w-[200px] items-center gap-1.5 rounded-lg border border-border/60 bg-bg-root py-1 pr-1 pl-1"
          >
            <img
              src={imageToFilePart(image).url}
              alt={image.name}
              className="size-8 shrink-0 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-ui-2xs text-fg-muted">{image.name}</span>
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              aria-label={`Remove ${image.name}`}
              title="Remove image"
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={10} weight="bold" />
            </button>
          </span>
        ))}
      </div>
      {unsupportedReason && <p className="text-ui-2xs text-status-error">{unsupportedReason}</p>}
    </div>
  );
}
