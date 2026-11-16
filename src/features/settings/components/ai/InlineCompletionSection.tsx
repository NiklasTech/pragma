"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

const DELAYS = [
  { ms: 250, label: "Quick" },
  { ms: 500, label: "Balanced" },
  { ms: 1000, label: "Patient" },
];

function delayLabel(ms: number): string {
  const delay = DELAYS.find((item) => item.ms === ms);
  return delay ? `${delay.label}, ${ms} ms` : `${ms} ms`;
}

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
        label="Wait before suggesting"
        description="How long you pause typing before a suggestion is requested"
        control={
          <Select
            value={String(debounce)}
            onValueChange={(value) => {
              if (typeof value === "string") onDebounceChange(Number(value));
            }}
          >
            <SelectTrigger className="max-w-[180px]" aria-label="Wait before suggesting">
              <SelectValue>{delayLabel(debounce)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DELAYS.map((item) => (
                <SelectItem key={item.ms} value={String(item.ms)}>
                  {delayLabel(item.ms)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
