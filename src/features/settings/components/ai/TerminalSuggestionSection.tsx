"use client";

import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PROVIDER_LABELS, isCLIOnlyProvider } from "@/shared/lib/ai-providers";
import type { AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

const SAME = "same";

const PROVIDERS = (Object.keys(PROVIDER_LABELS) as AIProvider[]).filter(
  (provider) => !isCLIOnlyProvider(provider),
);

function isProvider(value: string): value is AIProvider {
  return (PROVIDERS as string[]).includes(value);
}

/// Which model completes commands in the terminal; unset follows the editor's model.
export function TerminalSuggestionSection() {
  const provider = useSettingsStore((state) => state.ai.terminalSuggestionProvider);
  const model = useSettingsStore((state) => state.ai.terminalSuggestionModel);
  const editorProvider = useSettingsStore((state) => state.ai.defaultProvider);
  const editorModel = useSettingsStore((state) => state.ai.defaultModel);
  const setAISettings = useSettingsStore((state) => state.setAISettings);

  return (
    <SettingSection title="Terminal Suggestions">
      <SettingRow
        label="Terminal provider"
        description="Which provider suggests commands in the terminal"
        control={
          <Select
            value={provider ?? SAME}
            onValueChange={(value) => {
              if (value === SAME) setAISettings({ terminalSuggestionProvider: null });
              else if (typeof value === "string" && isProvider(value))
                setAISettings({ terminalSuggestionProvider: value });
            }}
          >
            <SelectTrigger className="max-w-[220px]">
              <SelectValue>
                {provider
                  ? PROVIDER_LABELS[provider]
                  : `Same as the editor (${PROVIDER_LABELS[editorProvider]})`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAME}>Same as the editor</SelectItem>
              {PROVIDERS.map((item) => (
                <SelectItem key={item} value={item}>
                  {PROVIDER_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Terminal model"
        description="Leave empty to use the editor's model"
        control={
          <Input
            value={model ?? ""}
            onChange={(event) =>
              setAISettings({ terminalSuggestionModel: event.target.value.trim() || null })
            }
            placeholder={editorModel || "Model name"}
            aria-label="Terminal suggestion model"
            className="max-w-[220px]"
          />
        }
      />
    </SettingSection>
  );
}
