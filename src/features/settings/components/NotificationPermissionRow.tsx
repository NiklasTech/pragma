"use client";

import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  openNotificationSettings,
  readNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from "@/features/ai/notifications/notifier";

import { SettingRow } from "./ui/SettingRow";

const DESCRIPTIONS: Record<NotificationPermission, string> = {
  granted: "Pragma may show system notifications.",
  denied: "System notifications are turned off for Pragma. Allow them in System Settings.",
  "not-determined": "Pragma has not asked for permission to show system notifications yet.",
  terminal:
    "Development builds send system notifications as Terminal. Allow notifications for Terminal in System Settings.",
  unavailable: "System notifications only work when Pragma runs from its app bundle.",
};

export function NotificationPermissionRow() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readNotificationPermission()
      .then((state) => {
        if (active) setPermission(state);
      })
      .catch((err: unknown) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const request = async () => {
    try {
      setError(null);
      setPermission(await requestNotificationPermission());
    } catch (err) {
      setError(String(err));
    }
  };

  const openSettings = async () => {
    try {
      setError(null);
      await openNotificationSettings();
    } catch (err) {
      setError(String(err));
    }
  };

  const description = error ?? (permission ? DESCRIPTIONS[permission] : "Checking permission...");

  return (
    <SettingRow
      label="System notification permission"
      description={description}
      control={
        permission === "not-determined" ? (
          <Button size="xs" variant="outline" onClick={() => void request()}>
            Request permission
          </Button>
        ) : permission === "denied" || permission === "terminal" ? (
          <Button size="xs" variant="outline" onClick={() => void openSettings()}>
            Open System Settings
          </Button>
        ) : null
      }
    />
  );
}
