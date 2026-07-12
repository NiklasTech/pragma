import { useMemo, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  FileText,
  FloppyDisk,
  X,
  SidebarSimple,
  Terminal,
  Plus,
  Gear,
  MagnifyingGlass,
  Robot,
  Command,
  SmileySad,
} from "@phosphor-icons/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/shared/components/ui/command";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";

const CATEGORY_TITLES: Record<string, string> = {
  file: "File",
  edit: "Edit",
  view: "View",
  search: "Search",
  ai: "AI",
  chat: "Chat",
};

const COMMAND_ICONS: Record<string, Icon> = {
  "file.open": FileText,
  "file.save": FloppyDisk,
  "file.closeTab": X,
  "view.toggleSidebar": SidebarSimple,
  "view.toggleTerminal": Terminal,
  "view.newTerminalTab": Plus,
  "view.openSettings": Gear,
  "view.commandPalette": Command,
  "search.findInFiles": MagnifyingGlass,
  "ai.toggle": Robot,
  "edit.editWithAI": Robot,
  "chat.send": Command,
};

function groupByCategory(commands: CommandPaletteItem[]): Map<string, CommandPaletteItem[]> {
  const grouped = new Map<string, CommandPaletteItem[]>();
  for (const command of commands) {
    const list = grouped.get(command.category) ?? [];
    list.push(command);
    grouped.set(command.category, list);
  }
  return grouped;
}

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const close = useCommandPaletteStore((state) => state.close);
  const commands = useCommandPaletteStore((state) => state.commands);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isMac = getIsMac();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const grouped = useMemo(() => groupByCategory(commands), [commands]);

  function handleSelect(command: CommandPaletteItem) {
    close();
    command.action();
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()} className="sm:max-w-xl">
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2">
            <SmileySad className="size-6 text-fg-muted" />
            <span className="text-ui-sm text-fg-muted">No commands found.</span>
          </div>
        </CommandEmpty>
        {Array.from(grouped.entries()).map(([category, items]) => (
          <CommandGroup key={category} heading={CATEGORY_TITLES[category] ?? category}>
            {items.map((command) => {
              const IconComponent = COMMAND_ICONS[command.id];
              const isHovered = hoveredId === command.id;
              return (
                <CommandItem
                  key={command.id}
                  value={command.id}
                  keywords={command.keywords}
                  onSelect={() => handleSelect(command)}
                  onMouseEnter={() => setHoveredId(command.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={
                    isHovered
                      ? "border-border-focus bg-bg-input animate-command-item-pulse"
                      : undefined
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {IconComponent && <IconComponent className="size-4 text-fg-subtle" />}
                    <span className="truncate">{command.label}</span>
                  </div>
                  {command.shortcut && (
                    <CommandShortcut>
                      {formatShortcut(shortcuts[command.shortcut], isMac)}
                    </CommandShortcut>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
