"use client";

import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore, type AutoSave } from "@/shared/stores/settings";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";

const AUTO_SAVE_LABELS: Record<AutoSave, string> = {
  off: "Off",
  onFocusChange: "On Focus Change",
  afterDelay: "After Delay",
};

export function EditorSettings() {
  const { editor, setEditorSettings } = useSettingsStore();

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Text">
        <SettingRow
          label="Font Size"
          description="Editor font size in pixels"
          control={
            <Input
              type="number"
              min={8}
              max={32}
              value={editor.fontSize}
              onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
              className="max-w-[180px]"
            />
          }
        />
        <SettingRow
          label="Font Family"
          description="Monospace font for the editor"
          control={
            <Input
              value={editor.fontFamily}
              onChange={(e) => setEditorSettings({ fontFamily: e.target.value })}
              placeholder="JetBrains Mono"
              className="max-w-[180px]"
            />
          }
        />
        <SettingRow
          label="Tab Size"
          description="Number of spaces per tab"
          control={
            <Input
              type="number"
              min={1}
              max={8}
              value={editor.tabSize}
              onChange={(e) => setEditorSettings({ tabSize: Number(e.target.value) })}
              className="max-w-[180px]"
            />
          }
        />
        <SettingRow
          label="Insert Spaces"
          description="Use spaces instead of tabs"
          control={
            <Switch
              checked={editor.insertSpaces}
              onCheckedChange={(v) => setEditorSettings({ insertSpaces: v })}
            />
          }
        />
        <SettingRow
          label="Word Wrap"
          description="Wrap long lines to fit the viewport"
          control={
            <Switch
              checked={editor.wordWrap}
              onCheckedChange={(v) => setEditorSettings({ wordWrap: v })}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Behavior">
        <SettingRow
          label="Vim Mode"
          description="Modal keybindings for the editor"
          control={
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-ui-xs text-primary">
                Experimental
              </span>
              <Switch
                checked={editor.vimMode}
                onCheckedChange={(v) => setEditorSettings({ vimMode: v })}
              />
            </div>
          }
        />
        <SettingRow
          label="Auto Save"
          description="Automatically save changed files"
          control={
            <Select
              value={editor.autoSave}
              onValueChange={(v) => setEditorSettings({ autoSave: v as AutoSave })}
            >
              <SelectTrigger className="max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUTO_SAVE_LABELS) as AutoSave[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {AUTO_SAVE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        {editor.autoSave === "afterDelay" && (
          <SettingRow
            label="Auto Save Delay"
            description="Milliseconds before auto save triggers"
            control={
              <Input
                type="number"
                min={100}
                step={100}
                value={editor.autoSaveDelay}
                onChange={(e) => setEditorSettings({ autoSaveDelay: Number(e.target.value) })}
                className="max-w-[180px]"
              />
            }
          />
        )}
        <SettingRow
          label="Format on Save"
          description="Run formatter when saving files"
          control={
            <Switch
              checked={editor.formatOnSave}
              onCheckedChange={(v) => setEditorSettings({ formatOnSave: v })}
            />
          }
        />
        <SettingRow
          label="Sticky Lines"
          description="Keep context lines visible while scrolling"
          control={
            <Switch
              checked={editor.stickyLines}
              onCheckedChange={(v) => setEditorSettings({ stickyLines: v })}
            />
          }
        />
        <SettingRow
          label="Line Numbers"
          description="Show line numbers in the gutter"
          control={
            <Switch
              checked={editor.lineNumbers}
              onCheckedChange={(v) => setEditorSettings({ lineNumbers: v })}
            />
          }
        />
      </SettingSection>
    </div>
  );
}
