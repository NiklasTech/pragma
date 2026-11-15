"use client";

import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type NotificationSettings as Settings } from "@/shared/stores/settings";

import { NotificationPermissionRow } from "./NotificationPermissionRow";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const WAYS: Array<{ key: keyof Settings; label: string; description: string }> = [
  {
    key: "card",
    label: "Card",
    description: "A small card at the bottom right while you work in Pragma.",
  },
  {
    key: "system",
    label: "System notification",
    description: "Only when Pragma is in the background.",
  },
  { key: "sound", label: "Sound", description: "A short tone, once per request." },
];

const EVENTS: Array<{ key: keyof Settings; label: string; description: string }> = [
  {
    key: "sessionFinished",
    label: "When an agent finishes",
    description: "Also pull you in when a session is done, not only when it waits for you.",
  },
  {
    key: "sessionFailed",
    label: "When an agent fails",
    description: "Also pull you in when a session stops with an error.",
  },
];

export function NotificationSettings() {
  const notifications = useSettingsStore((state) => state.notifications);
  const setNotificationSettings = useSettingsStore((state) => state.setNotificationSettings);

  const row = ({ key, label, description }: (typeof WAYS)[number]) => (
    <SettingRow
      key={key}
      label={label}
      description={description}
      control={
        <Switch
          checked={notifications[key]}
          onCheckedChange={(checked) => setNotificationSettings({ [key]: checked })}
        />
      }
    />
  );

  return (
    <>
      <SettingSection title="When an agent needs you">
        {WAYS.map(row)}
        <NotificationPermissionRow />
      </SettingSection>
      <SettingSection title="Also notify">{EVENTS.map(row)}</SettingSection>
    </>
  );
}
