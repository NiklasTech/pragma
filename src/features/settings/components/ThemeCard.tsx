import { Check, Copy, DotsThree, Export, Trash, WarningCircle } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { Theme } from "@/theme/types";
import { ThemePreview } from "./ThemePreview";

interface ThemeCardProps {
  theme: Theme;
  /** Splits the preview with a second theme, for following the system. */
  right?: Theme;
  /** Name shown under the preview; the theme's name by default. */
  label?: string;
  active: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  /** Contrast problems of the theme, shown as a warning. */
  warnings?: string[];
}

export function ThemeCard({
  theme,
  right,
  label = theme.metadata.name,
  active,
  onSelect,
  onDuplicate,
  onExport,
  onDelete,
  warnings = [],
}: ThemeCardProps) {
  const hasMenu = Boolean(onDuplicate || onExport || onDelete);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border transition-colors",
        active ? "border-fg-muted" : "border-border hover:border-fg-subtle",
      )}
    >
      <Button
        variant="ghost"
        onClick={onSelect}
        aria-pressed={active}
        className="h-auto flex-col items-stretch gap-2 p-2 text-left font-normal whitespace-normal text-fg-default hover:bg-transparent"
      >
        <ThemePreview theme={theme} right={right} />
        <span
          className={cn("flex min-w-0 items-center justify-between gap-1.5", hasMenu && "pr-6")}
        >
          <span className="truncate text-ui-sm text-fg-default">{label}</span>
          {warnings.length > 0 && (
            <WarningCircle
              size={14}
              weight="fill"
              className="shrink-0 text-status-warning"
              aria-label={warnings.join(". ")}
            >
              <title>{warnings.join(". ")}</title>
            </WarningCircle>
          )}
          {active && <Check size={14} weight="bold" className="shrink-0 text-fg-default" />}
        </span>
      </Button>
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${theme.metadata.name}`}
                className="absolute right-1.5 bottom-1.5 text-fg-muted"
              >
                <DotsThree size={14} weight="bold" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy size={14} />
                Duplicate
              </DropdownMenuItem>
            )}
            {onExport && (
              <DropdownMenuItem onClick={onExport}>
                <Export size={14} />
                Export
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash size={14} />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
