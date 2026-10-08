"use client";

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  useSettingsStore,
  type EditorCursorStyle,
  type RenderWhitespace,
} from "@/shared/stores/settings";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";
import { parseRulers } from "./editor-rulers";

const WHITESPACE_LABELS: Record<RenderWhitespace, string> = {
  none: "None",
  boundary: "Boundary",
  all: "All",
};

const CURSOR_STYLE_LABELS: Record<EditorCursorStyle, string> = {
  line: "Line",
  block: "Block",
  underline: "Underline",
};

function RulersInput() {
  const rulers = useSettingsStore((state) => state.editor.rulers);
  const setEditorSettings = useSettingsStore((state) => state.setEditorSettings);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      value={draft ?? rulers.join(", ")}
      placeholder="e.g. 80, 120"
      onChange={(e) => {
        setDraft(e.target.value);
        setEditorSettings({ rulers: parseRulers(e.target.value) });
      }}
      onBlur={() => setDraft(null)}
      className="max-w-[180px]"
    />
  );
}

export function EditorDisplaySettings() {
  const { editor, setEditorSettings } = useSettingsStore();

  return (
    <SettingSection title="Display">
      <SettingRow
        label="Render Whitespace"
        description="Show spaces and tabs. Boundary skips single spaces between words."
        control={
          <Select
            value={editor.renderWhitespace}
            onValueChange={(v) => setEditorSettings({ renderWhitespace: v as RenderWhitespace })}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{WHITESPACE_LABELS[editor.renderWhitespace]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WHITESPACE_LABELS) as RenderWhitespace[]).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {WHITESPACE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Rulers"
        description="Vertical lines at these columns, separated by commas"
        control={<RulersInput />}
      />
      <SettingRow
        label="Indent Guides"
        description="Show vertical lines at each indentation level"
        control={
          <Switch
            checked={editor.indentGuides}
            onCheckedChange={(v) => setEditorSettings({ indentGuides: v })}
          />
        }
      />
      <SettingRow
        label="Bracket Pair Colorization"
        description="Color matching brackets by nesting depth"
        control={
          <Switch
            checked={editor.bracketPairColorization}
            onCheckedChange={(v) => setEditorSettings({ bracketPairColorization: v })}
          />
        }
      />
      <SettingRow
        label="Cursor Style"
        control={
          <Select
            value={editor.cursorStyle}
            onValueChange={(v) => setEditorSettings({ cursorStyle: v as EditorCursorStyle })}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{CURSOR_STYLE_LABELS[editor.cursorStyle]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CURSOR_STYLE_LABELS) as EditorCursorStyle[]).map((style) => (
                <SelectItem key={style} value={style}>
                  {CURSOR_STYLE_LABELS[style]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Cursor Blinking"
        control={
          <Switch
            checked={editor.cursorBlinking}
            onCheckedChange={(v) => setEditorSettings({ cursorBlinking: v })}
          />
        }
      />
      <SettingRow
        label="Line Height"
        description="Line height as a multiple of the font size"
        control={
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={editor.lineHeight}
            onChange={(e) => {
              const value = Math.min(3, Math.max(1, Number(e.target.value)));
              setEditorSettings({ lineHeight: Number.isNaN(value) ? 1.6 : value });
            }}
            className="max-w-[180px]"
          />
        }
      />
      <SettingRow
        label="Font Ligatures"
        description="Combine character sequences like => into ligatures if the font has them"
        control={
          <Switch
            checked={editor.fontLigatures}
            onCheckedChange={(v) => setEditorSettings({ fontLigatures: v })}
          />
        }
      />
      <SettingRow
        label="Overview Markers"
        description="Mark diagnostics, search matches, git changes and the cursor next to the scrollbar"
        control={
          <Switch
            checked={editor.overviewMarkers}
            onCheckedChange={(v) => setEditorSettings({ overviewMarkers: v })}
          />
        }
      />
    </SettingSection>
  );
}
