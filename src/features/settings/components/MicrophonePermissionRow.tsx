"use client";

import { useCallback, useEffect, useState } from "react";

import {
  canOpenMicrophoneSettings,
  openMicrophoneSettings,
  readMicrophonePermission,
  requestMicrophonePermission,
  type MicrophonePermission,
} from "@/features/ai/dictation/microphonePermission";
import { Button } from "@/shared/components/ui/button";

import { SettingRow } from "./ui/SettingRow";

const DESCRIPTIONS: Record<MicrophonePermission, string> = {
  granted: "Pragma may use the microphone.",
  denied:
    "The microphone is turned off for Pragma. Allow it in System Settings, then dictate again.",
  "not-determined": "Pragma asks for the microphone the first time you dictate, or now.",
  restricted: "A device policy blocks the microphone for every app.",
  unavailable: "Development builds cannot use the microphone; the installed Pragma app can.",
  unknown: "Pragma asks for the microphone when you dictate; the system decides.",
};

/// The microphone permission with the one action that changes it: ask now, or open the setting.
export function MicrophonePermissionRow() {
  const [permission, setPermission] = useState<MicrophonePermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    readMicrophonePermission()
      .then(setPermission)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  useEffect(() => {
    refresh();
    // The user comes back from System Settings to this window.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const request = async () => {
    try {
      setError(null);
      setPermission(await requestMicrophonePermission());
    } catch (err) {
      setError(String(err));
    }
  };

  const openSettings = async () => {
    try {
      setError(null);
      await openMicrophoneSettings();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <SettingRow
      label="Microphone access"
      description={error ?? (permission ? DESCRIPTIONS[permission] : "Checking permission...")}
      control={
        permission === "not-determined" ? (
          <Button size="xs" variant="outline" onClick={() => void request()}>
            Allow microphone
          </Button>
        ) : permission && canOpenMicrophoneSettings(permission) ? (
          <Button size="xs" variant="outline" onClick={() => void openSettings()}>
            Open System Settings
          </Button>
        ) : null
      }
    />
  );
}
