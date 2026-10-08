import { useMemo, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
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
import {
  useCommandPaletteStore,
  type CommandPaletteItem,
  type CommandPalettePicker,
  type CommandPalettePickerItem,
  type CommandPalettePrompt,
} from "@/shared/stores/commandPalette";
import { PickerStep, PromptStep } from "./CommandPaletteStep";

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
  "search.find": MagnifyingGlass,
  "search.replace": ArrowsLeftRight,
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

interface StepInput {
  step: CommandPalettePicker | CommandPalettePrompt | null;
  isOpen: boolean;
  search: string;
  highlighted: string;
}

function initialStepInput(
  picker: CommandPalettePicker | null,
  prompt: CommandPalettePrompt | null,
  isOpen: boolean,
): StepInput {
  return {
    step: picker ?? prompt,
    isOpen,
    search: prompt?.initialValue ?? "",
    highlighted: picker?.initialItemId ?? "",
  };
}

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const picker = useCommandPaletteStore((state) => state.picker);
  const prompt = useCommandPaletteStore((state) => state.prompt);
  const close = useCommandPaletteStore((state) => state.close);
  const finish = useCommandPaletteStore((state) => state.finish);
  const commands = useCommandPaletteStore((state) => state.commands);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isMac = getIsMac();

  const grouped = useMemo(() => groupByCategory(commands), [commands]);

  // Reset during render so a new step never filters with the previous step's search.
  const [input, setInput] = useState(() => initialStepInput(picker, prompt, isOpen));
  const step = picker ?? prompt;
  let current = input;
  if (input.step !== step || input.isOpen !== isOpen) {
    current = initialStepInput(picker, prompt, isOpen);
    setInput(current);
  }

  function handleSelect(command: CommandPaletteItem) {
    finish();
    command.action();
  }

  function handlePickerSelect(activePicker: CommandPalettePicker, item: CommandPalettePickerItem) {
    finish();
    activePicker.onSelect(item);
  }

  function handlePromptSubmit(activePrompt: CommandPalettePrompt) {
    finish();
    activePrompt.onSubmit(current.search.trim());
  }

  function handleHighlight(value: string) {
    setInput((prev) => ({ ...prev, highlighted: value }));
    const item = picker?.items.find((candidate) => candidate.id === value);
    if (item) picker?.onHighlight?.(item);
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      className="sm:max-w-xl"
      commandProps={{
        value: current.highlighted,
        onValueChange: handleHighlight,
        shouldFilter: prompt === null,
      }}
    >
      <CommandInput
        placeholder={picker?.placeholder ?? prompt?.placeholder ?? "Search commands..."}
        value={current.search}
        onValueChange={(search) => setInput((prev) => ({ ...prev, search }))}
      />
      {picker ? (
        <CommandList>
          <PickerStep picker={picker} onSelect={(item) => handlePickerSelect(picker, item)} />
        </CommandList>
      ) : prompt ? (
        <CommandList>
          <PromptStep
            prompt={prompt}
            value={current.search}
            onSubmit={() => handlePromptSubmit(prompt)}
          />
        </CommandList>
      ) : (
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2">
              <SmileySad className="size-6 text-fg-muted" />
              <span>No commands found.</span>
            </div>
          </CommandEmpty>
          {Array.from(grouped.entries()).map(([category, items]) => (
            <CommandGroup key={category} heading={CATEGORY_TITLES[category] ?? category}>
              {items.map((command) => {
                const IconComponent = COMMAND_ICONS[command.id];
                return (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    keywords={command.keywords}
                    onSelect={() => handleSelect(command)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {IconComponent ? (
                        <IconComponent className="size-4 text-fg-subtle" />
                      ) : (
                        <span aria-hidden="true" className="size-4 shrink-0" />
                      )}
                      <span className="truncate">{command.label}</span>
                    </div>
                    {command.shortcut && shortcuts[command.shortcut] && (
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
      )}
    </CommandDialog>
  );
}
