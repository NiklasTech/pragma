"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { X } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerBackdrop({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 isolate z-[70] bg-bg-overlay opacity-0 transition-opacity duration-200 data-[open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  side?: "left" | "right" | "top" | "bottom";
  showCloseButton?: boolean;
}) {
  const sideStyles = {
    left: "top-(--chrome-header-h) bottom-0 left-0 w-full max-w-lg rounded-tr-xl",
    right: "top-(--chrome-header-h) bottom-0 right-0 w-full max-w-4xl rounded-tl-xl",
    top: "inset-x-0 top-(--chrome-header-h) w-full max-h-[80vh] rounded-b-xl",
    bottom: "inset-x-0 bottom-0 w-full max-h-[80vh] rounded-t-xl",
  };

  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "fixed z-[70] flex flex-col overflow-hidden border border-border bg-bg-elevated p-0 text-ui-sm text-fg-default shadow-[var(--shadow-md)] ring-0 opacity-0 transition-opacity duration-150 outline-none data-[open]:opacity-100",
          sideStyles[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerPrimitive.Close
            data-slot="drawer-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-xs" />}
          >
            <X />
            <span className="sr-only">Close</span>
          </DrawerPrimitive.Close>
        )}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex shrink-0 flex-col gap-1 border-b border-border-subtle py-3 pr-12 pl-4",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "flex flex-col-reverse gap-2 rounded-b-lg border-t border-border/40 bg-bg-hover p-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-sm leading-none font-semibold text-fg-default", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-xs text-fg-muted", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerBackdrop,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
