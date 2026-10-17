import { Palette } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTheme, type Theme } from "@/theme";
import { EditorColorsDialog } from "./EditorColorsDialog";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const SAME_AS_UI = "__ui__";

function ThemeChoice({
  value,
  themes,
  onChange,
}: {
  value: string;
  themes: Theme[];
  onChange: (id: string) => void;
}) {
  const selected = themes.find((theme) => theme.metadata.id === value);
  return (
    <Select
      value={selected ? value : SAME_AS_UI}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next === SAME_AS_UI ? "" : next);
      }}
    >
      <SelectTrigger className="max-w-[220px]">
        <SelectValue>{selected ? selected.metadata.name : "Same as UI theme"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SAME_AS_UI}>Same as UI theme</SelectItem>
        {themes.map((theme) => (
          <SelectItem key={theme.metadata.id} value={theme.metadata.id}>
            {theme.metadata.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EditorAppearanceSettings() {
  const { availableThemes } = useTheme();
  const editor = useSettingsStore((s) => s.editor);
  const terminalTheme = useSettingsStore((s) => s.terminal.colorTheme);
  const setEditorSettings = useSettingsStore((s) => s.setEditorSettings);
  const setTerminalSettings = useSettingsStore((s) => s.setTerminalSettings);
  const [colorsOpen, setColorsOpen] = useState(false);
  const overrideCount = Object.keys(editor.colorOverrides ?? {}).length;

  return (
    <SettingSection title="Editor">
      <SettingRow
        label="Editor Theme"
        description="Editor, gutter and diff colors. Pick another theme to give the editor its own look."
        control={
          <ThemeChoice
            value={editor.colorTheme}
            themes={availableThemes}
            onChange={(id) => setEditorSettings({ colorTheme: id })}
          />
        }
      />
      <SettingRow
        label="Terminal Theme"
        description="Colors of the terminals."
        control={
          <ThemeChoice
            value={terminalTheme}
            themes={availableThemes}
            onChange={(id) => setTerminalSettings({ colorTheme: id })}
          />
        }
      />
      <SettingRow
        label="Editor Colors"
        description={
          overrideCount > 0
            ? `${overrideCount} ${overrideCount === 1 ? "color" : "colors"} overridden`
            : "Override the editor background or single syntax colors."
        }
        control={
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setColorsOpen(true)}>
            <Palette size={14} />
            Customize
          </Button>
        }
      />
      <EditorColorsDialog open={colorsOpen} onOpenChange={setColorsOpen} />
    </SettingSection>
  );
}
