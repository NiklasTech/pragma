import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { getIsMac } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { defaultSettings } from "@/shared/stores/settings/defaults";
import {
  clampUiScale,
  isUiDensity,
  UI_DENSITIES,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  type UiDensity,
} from "@/theme/uiMetrics";
import { FontSelect } from "./FontSelect";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const DENSITY_LABELS: Record<UiDensity, string> = {
  compact: "Compact",
  default: "Default",
  comfortable: "Comfortable",
};

const UI_SCALES = Array.from(
  { length: (UI_SCALE_MAX - UI_SCALE_MIN) / UI_SCALE_STEP + 1 },
  (_, i) => UI_SCALE_MIN + i * UI_SCALE_STEP,
);

export function InterfaceSettings() {
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearanceSettings = useSettingsStore((s) => s.setAppearanceSettings);
  const uiScale = clampUiScale(appearance.uiScale);
  const density = isUiDensity(appearance.density) ? appearance.density : "default";
  const mod = getIsMac() ? "Cmd" : "Ctrl";

  return (
    <SettingSection
      title="Interface"
      action={
        <Button
          variant="outline"
          size="xs"
          className="gap-1"
          onClick={() => setAppearanceSettings(defaultSettings.appearance)}
        >
          <ArrowCounterClockwise size={12} />
          Reset to Default
        </Button>
      }
    >
      <SettingRow
        label="Density"
        description="Row, tab and bar heights and the spacing across sidebar, tabs, threads and the git panel."
        control={
          <Select
            value={density}
            onValueChange={(value) => {
              if (isUiDensity(value)) setAppearanceSettings({ density: value });
            }}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{DENSITY_LABELS[density]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {UI_DENSITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {DENSITY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="UI Scale"
        description={`Scales interface text and sizes; the editor and terminal keep their own font size. ${mod}+Plus, ${mod}+Minus and ${mod}+0 change and reset it.`}
        control={
          <Select
            value={String(uiScale)}
            onValueChange={(value) =>
              setAppearanceSettings({ uiScale: clampUiScale(Number(value)) })
            }
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{`${uiScale}%`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {UI_SCALES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {`${value}%`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="UI Font"
        description="Font for the interface. Leave the custom font empty to use the default."
        control={
          <FontSelect
            value={{ fontId: appearance.uiFontId, fontFamily: appearance.uiFontFamily }}
            onChange={({ fontId, fontFamily }) =>
              setAppearanceSettings({ uiFontId: fontId, uiFontFamily: fontFamily })
            }
          />
        }
      />
    </SettingSection>
  );
}
