"use client";

import { useShallow } from "zustand/react/shallow";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore, type TerminalCursorStyle } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";
import { FontSelect } from "./FontSelect";
import { TerminalEnvSettings } from "./TerminalEnvSettings";

const CURSOR_STYLE_LABELS: Record<TerminalCursorStyle, string> = {
  block: "Block",
  underline: "Underline",
  bar: "Bar",
};

export function TerminalSettings() {
  const { terminal, setTerminalSettings } = useSettingsStore(
    useShallow((s) => ({ terminal: s.terminal, setTerminalSettings: s.setTerminalSettings })),
  );
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
    <div className="flex flex-col gap-8">
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
        <div className="grid grid-cols-2 gap-3 py-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Font Size</span>
            <Input
              type="number"
              min={8}
              max={32}
              value={terminal.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
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
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Line Height</span>
            <Input
              type="number"
              min={1}
              max={2}
              step={0.1}
              value={terminal.lineHeight}
              onChange={(e) => {
                const value = Math.min(2, Math.max(1, Number(e.target.value)));
                update({ lineHeight: Number.isNaN(value) ? 1 : value });
              }}
            />
          </div>
          <div className="col-span-full flex min-w-0 flex-col gap-1.5">
            <span className="text-ui-sm text-fg-default">Font Family</span>
            <FontSelect
              value={{ fontId: terminal.fontId, fontFamily: terminal.fontFamily }}
              onChange={(v) => update({ fontId: v.fontId, fontFamily: v.fontFamily })}
            />
          </div>
        </div>
        <SettingRow
          label="Cursor Style"
          control={
            <Select
              value={terminal.cursorStyle}
              onValueChange={(v) => update({ cursorStyle: v as TerminalCursorStyle })}
            >
              <SelectTrigger className="max-w-[200px]">
                <SelectValue>{CURSOR_STYLE_LABELS[terminal.cursorStyle]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CURSOR_STYLE_LABELS) as TerminalCursorStyle[]).map((style) => (
                  <SelectItem key={style} value={style}>
                    {CURSOR_STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          label="Cursor Blink"
          control={
            <Switch
              checked={terminal.cursorBlink}
              onCheckedChange={(v) => update({ cursorBlink: v })}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Behavior">
        <SettingRow
          label="Copy on Select"
          description="Copy selected terminal text to the clipboard automatically"
          control={
            <Switch
              checked={terminal.copyOnSelect}
              onCheckedChange={(v) => update({ copyOnSelect: v })}
            />
          }
        />
        <SettingRow
          label="Restore Scrollback"
          description="Also restore terminal output after a restart. Tabs, splits and working directories are always restored."
          control={
            <Switch
              checked={terminal.restoreScrollback}
              onCheckedChange={(v) => update({ restoreScrollback: v })}
            />
          }
        />
      </SettingSection>

      <TerminalEnvSettings />

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
