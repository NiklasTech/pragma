import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore } from "@/shared/stores/settings";
import { generateCssVariables, useTheme, type Theme } from "@/theme";
import { formatColor, parseColor } from "@/theme/color";
import { EDITOR_COLOR_KEYS, type EditorColorKey } from "@/theme/editorColors";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const SAME_AS_UI = "__ui__";

const COLOR_LABELS: Record<EditorColorKey, string> = {
  background: "Background",
  keyword: "Keywords",
  string: "Strings",
  comment: "Comments",
  function: "Functions",
  variable: "Variables",
  number: "Numbers",
  type: "Types",
  tag: "Tags",
  attribute: "Attributes",
  property: "Properties",
  operator: "Operators",
};

function colorVariable(key: EditorColorKey): string {
  return key === "background" ? "--editor-bg" : `--syntax-${key}`;
}

/** The color input needs an opaque #rrggbb value. */
function toInputColor(value: string | undefined): string {
  const parsed = value ? parseColor(value) : null;
  return parsed ? formatColor({ ...parsed, a: 1 }) : "#000000";
}

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
  const { theme, availableThemes } = useTheme();
  const editor = useSettingsStore((s) => s.editor);
  const terminalTheme = useSettingsStore((s) => s.terminal.colorTheme);
  const setEditorSettings = useSettingsStore((s) => s.setEditorSettings);
  const setTerminalSettings = useSettingsStore((s) => s.setTerminalSettings);

  const overrides = editor.colorOverrides ?? {};
  const editorTheme = availableThemes.find((t) => t.metadata.id === editor.colorTheme) ?? theme;
  const baseColors = useMemo(
    () => new Map(generateCssVariables(editorTheme).map(({ name, value }) => [name, value])),
    [editorTheme],
  );

  const setOverride = (key: EditorColorKey, value: string | undefined) => {
    const next = { ...overrides };
    if (value === undefined) delete next[key];
    else next[key] = value;
    setEditorSettings({ colorOverrides: next });
  };

  return (
    <SettingSection
      title="Editor"
      action={
        Object.keys(overrides).length > 0 ? (
          <Button
            variant="outline"
            size="xs"
            className="gap-1"
            onClick={() => setEditorSettings({ colorOverrides: {} })}
          >
            <ArrowCounterClockwise size={12} />
            Reset All Colors
          </Button>
        ) : undefined
      }
    >
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
      {EDITOR_COLOR_KEYS.map((key) => {
        const override = overrides[key];
        return (
          <SettingRow
            key={key}
            label={COLOR_LABELS[key]}
            description={override ? "Overridden" : undefined}
            control={
              <div className="flex items-center gap-1.5">
                <Input
                  type="color"
                  aria-label={`${COLOR_LABELS[key]} color`}
                  value={toInputColor(override ?? baseColors.get(colorVariable(key)))}
                  onChange={(e) => setOverride(key, e.target.value)}
                  className="h-7 w-10 cursor-pointer p-0.5"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={`Reset ${COLOR_LABELS[key].toLowerCase()}`}
                  disabled={!override}
                  onClick={() => setOverride(key, undefined)}
                >
                  <ArrowCounterClockwise size={12} />
                </Button>
              </div>
            }
          />
        );
      })}
    </SettingSection>
  );
}
