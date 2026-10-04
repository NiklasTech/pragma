import { useRef } from "react";
import { ImageSquare } from "@phosphor-icons/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import type { ImageInputSupport } from "./imageSupport";
import { ACCEPTED_IMAGE_TYPES } from "./readImage";

interface ComposerImageButtonProps {
  support: ImageInputSupport;
  onPick: (files: File[]) => void;
}

export function ComposerImageButton({ support, onPick }: ComposerImageButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = support.supported ? "Attach images" : support.reason;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
      <Tooltip>
        <TooltipTrigger
          delay={300}
          aria-label="Attach images"
          // aria-disabled keeps the tooltip reachable, which a disabled button would not be.
          aria-disabled={!support.supported}
          onClick={() => {
            if (support.supported) inputRef.current?.click();
          }}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            support.supported
              ? "hover:bg-bg-hover hover:text-fg-default"
              : "cursor-not-allowed opacity-40",
          )}
        >
          <ImageSquare size={14} weight="bold" />
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </>
  );
}
