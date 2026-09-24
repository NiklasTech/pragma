"use client";

import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

interface InlineCompletionSectionProps {
  enabled: boolean;
  debounce: number;
  onEnabledChange: (enabled: boolean) => void;
  onDebounceChange: (debounce: number) => void;
}

export function InlineCompletionSection({
  enabled,
  debounce,
  onEnabledChange,
  onDebounceChange,
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
    </SettingSection>
  );
}
