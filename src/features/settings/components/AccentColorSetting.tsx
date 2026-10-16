import { Check } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTheme } from "@/theme";
import { ACCENT_PRESETS, readableAccent } from "@/theme/accent";
import { formatColor, parseColor } from "@/theme/color";
import { SettingRow } from "./ui/SettingRow";

function toInputColor(value: string): string {
  const parsed = parseColor(value);
  return parsed ? formatColor({ ...parsed, a: 1 }) : "#2f9bff";
}

export function AccentColorSetting() {
  const { theme } = useTheme();
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);
  const setAppearanceSettings = useSettingsStore((s) => s.setAppearanceSettings);
  const readable = accentColor ? readableAccent(theme, accentColor) : null;
  const setAccent = (value: string) => setAppearanceSettings({ accentColor: value });

  return (
    <SettingRow
      label="Accent Color"
      description={
        readable?.adjusted
          ? `Adjusted to ${readable.color} so text on buttons stays readable on this theme.`
          : "Buttons, focus rings, selection and active indicators. Applies to every theme."
      }
      control={
        <div className="flex items-center gap-1.5">
          <Button
            variant={accentColor ? "outline" : "secondary"}
            size="xs"
            aria-pressed={!accentColor}
            onClick={() => setAccent("")}
          >
            Theme Default
          </Button>
          {ACCENT_PRESETS.map((preset) => {
            const active = accentColor.toLowerCase() === preset;
            return (
              <button
                key={preset}
                type="button"
                title={preset}
                aria-label={`Accent ${preset}`}
                aria-pressed={active}
                onClick={() => setAccent(preset)}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border border-border/40",
                  active && "ring-2 ring-border-focus ring-offset-1 ring-offset-bg-root",
                )}
                style={{ backgroundColor: preset }}
              >
                {active && <Check size={10} weight="bold" className="text-black/70" />}
              </button>
            );
          })}
          <Input
            type="color"
            aria-label="Custom accent color"
            value={toInputColor(accentColor || theme.tokens.colors.accent.default)}
            onChange={(e) => setAccent(e.target.value)}
            className="h-7 w-10 cursor-pointer p-0.5"
          />
        </div>
      }
    />
  );
}
