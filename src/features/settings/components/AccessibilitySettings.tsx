import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  isReduceMotionSetting,
  REDUCE_MOTION_SETTINGS,
  type ReduceMotionSetting,
} from "@/theme/accessibility";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const REDUCE_MOTION_LABELS: Record<ReduceMotionSetting, string> = {
  system: "Follow System",
  on: "On",
  off: "Off",
};

export function AccessibilitySettings() {
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearanceSettings = useSettingsStore((s) => s.setAppearanceSettings);
  const reduceMotion = isReduceMotionSetting(appearance.reduceMotion)
    ? appearance.reduceMotion
    : "system";

  return (
    <SettingSection title="Accessibility">
      <SettingRow
        label="Reduce Motion"
        description="Removes transitions and animations of panels, dialogs and lists."
        control={
          <Select
            value={reduceMotion}
            onValueChange={(value) => {
              if (isReduceMotionSetting(value)) setAppearanceSettings({ reduceMotion: value });
            }}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{REDUCE_MOTION_LABELS[reduceMotion]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REDUCE_MOTION_SETTINGS.map((value) => (
                <SelectItem key={value} value={value}>
                  {REDUCE_MOTION_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Always Show Focus Outlines"
        description="Keeps a thick outline on the focused control, also after mouse clicks."
        control={
          <Switch
            checked={appearance.alwaysShowFocus}
            onCheckedChange={(alwaysShowFocus) => setAppearanceSettings({ alwaysShowFocus })}
          />
        }
      />
      <SettingRow
        label="Color Blind Friendly Status Colors"
        description="Git, diff and status colors that stay apart with red-green color vision deficiency. Status letters and markers stay in place."
        control={
          <Switch
            checked={appearance.colorBlindStatus}
            onCheckedChange={(colorBlindStatus) => setAppearanceSettings({ colorBlindStatus })}
          />
        }
      />
    </SettingSection>
  );
}
