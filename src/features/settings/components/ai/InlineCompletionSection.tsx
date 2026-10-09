"use client";

import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

interface InlineCompletionSectionProps {
  enabled: boolean;
  debounce: number;
  nextEdit: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onDebounceChange: (debounce: number) => void;
  onNextEditChange: (enabled: boolean) => void;
}

export function InlineCompletionSection({
  enabled,
  debounce,
  nextEdit,
  onEnabledChange,
  onDebounceChange,
  onNextEditChange,
}: InlineCompletionSectionProps) {
  return (
    <SettingSection title="Inline Completion">
      <SettingRow
        label="Enable"
        description="Show AI ghost-text suggestions in the editor"
        control={<Switch checked={enabled} onCheckedChange={onEnabledChange} />}
      />
      <SettingRow
        label="Debounce"
        description="Milliseconds to wait before requesting a suggestion"
        control={
          <Input
            type="number"
            min={100}
            step={50}
            value={debounce}
            onChange={(e) => onDebounceChange(Number(e.target.value))}
            className="max-w-[180px]"
          />
        }
      />
      <SettingRow
        label="Next edit prediction"
        description="After you pause, suggest the next change elsewhere in the file. Tab jumps to it, Tab again applies it."
        control={
          <Switch checked={nextEdit} disabled={!enabled} onCheckedChange={onNextEditChange} />
        }
      />
    </SettingSection>
  );
}
