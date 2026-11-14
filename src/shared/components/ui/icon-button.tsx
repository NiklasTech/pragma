import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** The two icon sizes of the interface: inline and in buttons. */
export const ICON_SIZE = { sm: 14, md: 16 } as const;

type ButtonProps = React.ComponentProps<typeof Button>;

interface IconButtonProps extends Omit<ButtonProps, "children" | "size" | "variant"> {
  icon: Icon;
  /** Read by screen readers and shown as a tooltip. */
  label: string;
  size?: keyof typeof ICON_SIZE;
  /** Shortcut shown after the label in the tooltip, for example "⌘K". */
  shortcut?: string;
}

/** A ghost button with only an icon; the label is its accessible name and tooltip. */
export function IconButton({
  icon: IconComponent,
  label,
  size = "md",
  shortcut,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            aria-label={label}
            className={cn(
              size === "md" ? "size-7 rounded-[7px]" : "size-6 rounded-[6px]",
              className,
            )}
            {...props}
          />
        }
      >
        <IconComponent size={ICON_SIZE[size]} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="font-mono text-fg-subtle">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
