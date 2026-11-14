"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

// Base UI's modal dialog traps focus, closes on Escape and returns focus to where it was.
function OverlaySheet(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="overlay-sheet" {...props} />;
}

const OverlaySheetTrigger = DialogPrimitive.Trigger;
const OverlaySheetClose = DialogPrimitive.Close;

const overlaySheetVariants = cva(
  "fixed inset-x-0 z-[70] mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-sheet bg-bg-sheet text-ui-sm text-fg-default shadow-[var(--shadow-md)] ring-1 ring-border outline-none transition-[opacity,translate,scale] duration-(--motion-base) ease-(--motion-ease-out) data-starting-style:translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  {
    variants: {
      placement: {
        /** Dialogs and detail views. */
        center: "inset-y-0 my-auto h-fit max-h-[calc(100%-4rem)]",
        /** Pickers and command lists that grow downward while filtering. */
        top: "top-[12vh] max-h-[76vh]",
      },
    },
    defaultVariants: { placement: "center" },
  },
);

function OverlaySheetContent({
  className,
  placement,
  ...props
}: DialogPrimitive.Popup.Props & VariantProps<typeof overlaySheetVariants>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="overlay-sheet-scrim"
        className="fixed inset-0 z-[70] bg-bg-overlay backdrop-blur-[2px] transition-opacity duration-(--motion-base) ease-(--motion-ease-out) data-starting-style:opacity-0 data-ending-style:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="overlay-sheet-content"
        className={cn(overlaySheetVariants({ placement }), className)}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function OverlaySheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="overlay-sheet-header"
      className={cn("flex shrink-0 items-center gap-3 py-3.5 pr-4 pl-5.5", className)}
      {...props}
    />
  );
}

function OverlaySheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="overlay-sheet-title"
      className={cn("text-ui-lg font-semibold tracking-tight text-fg-default", className)}
      {...props}
    />
  );
}

function OverlaySheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="overlay-sheet-description"
      className={cn("text-ui-sm text-fg-muted", className)}
      {...props}
    />
  );
}

export {
  OverlaySheet,
  OverlaySheetClose,
  OverlaySheetContent,
  OverlaySheetDescription,
  OverlaySheetHeader,
  OverlaySheetTitle,
  OverlaySheetTrigger,
  overlaySheetVariants,
};
