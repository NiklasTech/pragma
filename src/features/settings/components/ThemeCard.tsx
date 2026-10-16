import { Check, Copy, DotsThree, Export, Trash } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import type { Theme } from "@/theme/types";

function getThemePreviewColors(theme: Theme): [string, string, string, string] {
  const tokens = theme.tokens;
  const bg = tokens.colors?.background?.root ?? tokens.editor?.background ?? "#1a1b26";
  const fg = tokens.colors?.foreground?.default ?? tokens.editor?.foreground ?? "#c0caf5";
  const primary = tokens.colors?.accent?.default ?? "#7aa2f7";
  const accent = tokens.colors?.accent?.subtle ?? "#565f89";
  return [bg, fg, primary, accent];
}

interface ThemeCardProps {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete?: () => void;
}

export function ThemeCard({
  theme,
  active,
  onSelect,
  onDuplicate,
  onExport,
  onDelete,
}: ThemeCardProps) {
  const [bg, fg, primary, accent] = getThemePreviewColors(theme);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border transition-colors",
        active ? "border-primary" : "border-border/60 hover:border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex flex-col gap-2 p-2 text-left"
      >
        <span
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-md border border-border/30"
          style={{ backgroundColor: bg }}
        >
          <ColorSwatch color={fg} />
          <ColorSwatch color={primary} />
          <ColorSwatch color={accent} />
        </span>
        <span className="flex min-w-0 items-center justify-between gap-1.5 pr-6">
          <span className="truncate text-ui-sm text-fg-default">{theme.metadata.name}</span>
          {active && <Check size={14} weight="bold" className="shrink-0 text-primary" />}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${theme.metadata.name}`}
              className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              <DotsThree size={14} weight="bold" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy size={14} />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Export size={14} />
            Export
          </DropdownMenuItem>
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
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="size-3 rounded-sm border border-border/30"
      style={{ backgroundColor: color }}
    />
  );
}
