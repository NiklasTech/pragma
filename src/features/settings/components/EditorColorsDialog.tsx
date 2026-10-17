import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { useSettingsStore } from "@/shared/stores/settings";
import { generateCssVariables, useTheme } from "@/theme";
import { formatColor, parseColor } from "@/theme/color";
import { EDITOR_COLOR_KEYS, type EditorColorKey } from "@/theme/editorColors";
import { SettingRow } from "./ui/SettingRow";

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

interface EditorColorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditorColorsDialog({ open, onOpenChange }: EditorColorsDialogProps) {
  const { theme, availableThemes } = useTheme();
  const editor = useSettingsStore((s) => s.editor);
  const setEditorSettings = useSettingsStore((s) => s.setEditorSettings);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col gap-2 overflow-hidden p-0">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-2 px-4 pt-4 pr-10">
          <DialogTitle className="text-ui-base">Editor Colors</DialogTitle>
          <Button
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={Object.keys(overrides).length === 0}
            onClick={() => setEditorSettings({ colorOverrides: {} })}
          >
            <ArrowCounterClockwise size={12} />
            Reset All
          </Button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto px-4 pb-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
