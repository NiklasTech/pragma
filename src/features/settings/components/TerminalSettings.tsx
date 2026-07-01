"use client";

import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";
import { FontSelect } from "./FontSelect";

export function TerminalSettings() {
  const { terminal, setTerminalSettings } = useSettingsStore();
  const terminalStore = useTerminalStore();

  const update = (partial: Parameters<typeof setTerminalSettings>[0]) => {
    setTerminalSettings(partial);
    if ("shell" in partial) terminalStore.setDefaultShell(partial.shell ?? terminal.shell);
    if ("fontSize" in partial) terminalStore.setFontSize(partial.fontSize ?? terminal.fontSize);
    if ("fontFamily" in partial)
      terminalStore.setFontFamily(partial.fontFamily ?? terminal.fontFamily);
    if ("fontId" in partial) terminalStore.setFontId(partial.fontId ?? terminal.fontId);
    if ("scrollback" in partial)
      terminalStore.setScrollback(partial.scrollback ?? terminal.scrollback);
    if ("aiSuggestions" in partial)
      terminalStore.setAiSuggestions(partial.aiSuggestions ?? terminal.aiSuggestions);
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Shell">
        <SettingRow
          label="Default Shell"
          description="Path to the shell executable. Leave empty to use the system default."
          control={
            <Input
              value={terminal.shell}
              onChange={(e) => update({ shell: e.target.value })}
              placeholder="System default"
              className="max-w-[180px]"
            />
          }
        />
      </SettingSection>

      <SettingSection title="Appearance">
        <div className="grid grid-cols-3 gap-3 py-2.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Font Size</span>
            <Input
              type="number"
              min={8}
              max={32}
              value={terminal.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Font Family</span>
            <FontSelect
              value={{ fontId: terminal.fontId, fontFamily: terminal.fontFamily }}
              onChange={(v) => update({ fontId: v.fontId, fontFamily: v.fontFamily })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Scrollback</span>
            <Input
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={terminal.scrollback}
              onChange={(e) => {
                const value = Math.min(100000, Math.max(1000, Number(e.target.value)));
                update({ scrollback: Number.isNaN(value) ? 10000 : value });
              }}
            />
          </div>
        </div>
      </SettingSection>

      <SettingSection title="AI">
        <SettingRow
          label="Command Suggestions"
          description="Show AI-powered command suggestions while typing"
          control={
            <Switch
              checked={terminal.aiSuggestions}
              onCheckedChange={(v) => update({ aiSuggestions: v })}
            />
          }
        />
      </SettingSection>
    </div>
  );
}
