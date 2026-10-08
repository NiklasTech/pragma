import { SmileySad } from "@phosphor-icons/react";
import { CommandEmpty, CommandGroup, CommandItem } from "@/shared/components/ui/command";
import type {
  CommandPalettePicker,
  CommandPalettePickerItem,
  CommandPalettePrompt,
} from "@/shared/stores/commandPalette";

const PROMPT_SUBMIT_VALUE = "__prompt-submit__";

function canSubmitPrompt(prompt: CommandPalettePrompt, value: string): boolean {
  return prompt.allowEmpty === true || value.trim().length > 0;
}

export function PickerStep({
  picker,
  onSelect,
}: {
  picker: CommandPalettePicker;
  onSelect: (item: CommandPalettePickerItem) => void;
}) {
  return (
    <>
      <CommandEmpty>
        <div className="flex flex-col items-center gap-2">
          <SmileySad className="size-6 text-fg-muted" />
          <span>{picker.emptyText}</span>
        </div>
      </CommandEmpty>
      <CommandGroup>
        {picker.items.map((item) => (
          <CommandItem
            key={item.id}
            value={item.id}
            keywords={[item.label, ...(item.detail ? [item.detail] : []), ...(item.keywords ?? [])]}
            onSelect={() => onSelect(item)}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="truncate">{item.label}</span>
              {item.detail && (
                <span className="truncate text-ui-xs text-fg-subtle">{item.detail}</span>
              )}
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

export function PromptStep({
  prompt,
  value,
  onSubmit,
}: {
  prompt: CommandPalettePrompt;
  value: string;
  onSubmit: () => void;
}) {
  return (
    <CommandGroup>
      <CommandItem
        value={PROMPT_SUBMIT_VALUE}
        disabled={!canSubmitPrompt(prompt, value)}
        onSelect={onSubmit}
      >
        <span className="truncate">{prompt.submitLabel(value.trim())}</span>
      </CommandItem>
    </CommandGroup>
  );
}
