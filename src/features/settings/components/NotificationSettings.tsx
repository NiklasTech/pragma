"use client";

import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type NotificationSettings as Settings } from "@/shared/stores/settings";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const ROWS: Array<{ key: keyof Settings; label: string; description: string }> = [
  {
    key: "sessionFinished",
    label: "Session finished",
    description: "Notify when a session completes while Pragma is in the background.",
  },
  {
    key: "sessionFailed",
    label: "Session failed",
    description: "Notify when a session stops with an error while Pragma is in the background.",
  },
  {
    key: "approvalNeeded",
    label: "Approval needed",
    description: "Notify when a session waits for your approval while Pragma is in the background.",
  },
  {
    key: "badge",
    label: "Dock badge",
    description: "Show the number of sessions waiting for approval on the app icon.",
  },
  {
    key: "statusSummary",
    label: "Status bar summary",
    description: "Show running and waiting sessions in the status bar.",
  },
];

export function NotificationSettings() {
  const notifications = useSettingsStore((state) => state.notifications);
  const setNotificationSettings = useSettingsStore((state) => state.setNotificationSettings);

  return (
    <SettingSection title="Notifications">
      {ROWS.map((row) => (
        <SettingRow
          key={row.key}
          label={row.label}
          description={row.description}
          control={
            <Switch
              checked={notifications[row.key]}
              onCheckedChange={(checked) => setNotificationSettings({ [row.key]: checked })}
            />
          }
        />
      ))}
    </SettingSection>
  );
}
