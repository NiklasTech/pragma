import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import type { CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useSettingsStore } from "@/shared/stores/settings";

interface CommandListProps {
  id: string;
  commands: CommandPaletteItem[];
  selected: number;
  onHover: (index: number) => void;
  onRun: (command: CommandPaletteItem) => void;
}

/// The commands that match what follows "/" in the command line, above it.
export function CommandList({ id, commands, selected, onHover, onRun }: CommandListProps) {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isMac = getIsMac();

  return (
    <div className="absolute bottom-full left-3 z-50 mb-1.5 w-[min(560px,calc(100%-1.5rem))] overflow-hidden rounded-well bg-bg-sheet font-mono shadow-[var(--shadow-md)] ring-1 ring-border animate-in duration-150 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
      <div className="flex h-8 items-center border-b border-border px-3 text-[10px] tracking-[0.08em] text-fg-subtle uppercase">
        commands
      </div>
      {commands.length === 0 ? (
        <p className="px-3 py-3 text-ui-xs text-fg-subtle">No command matches.</p>
      ) : (
        <div id={id} role="listbox" aria-label="Commands" className="py-1">
          {commands.map((command, index) => {
            const binding = command.shortcut ? shortcuts[command.shortcut] : null;
            const active = index === selected;
            return (
              <Button
                key={command.id}
                id={`${id}-${index}`}
                variant="ghost"
                role="option"
                aria-selected={active}
                tabIndex={-1}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRun(command)}
                className={cn(
                  "h-8 w-full justify-start gap-2.5 rounded-none px-3 text-ui-xs font-normal",
                  active && "bg-bg-active shadow-[inset_2px_0_0_var(--color-accent)]",
                )}
              >
                <span className={cn("truncate", active ? "text-primary" : "text-fg-default")}>
                  /{command.label.toLowerCase()}
                </span>
                <span className="truncate text-fg-subtle">{command.category}</span>
                {binding && <Kbd className="ml-auto">{formatShortcut(binding, isMac)}</Kbd>}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
