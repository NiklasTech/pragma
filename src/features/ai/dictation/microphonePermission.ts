import { invoke } from "@tauri-apps/api/core";

/** Mirrors `MicrophonePermission` in `src-tauri/src/modules/microphone_permission.rs`. */
export type MicrophonePermission =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "unavailable"
  | "unknown";

export function readMicrophonePermission(): Promise<MicrophonePermission> {
  return invoke<MicrophonePermission>("microphone_permission");
}

export function requestMicrophonePermission(): Promise<MicrophonePermission> {
  return invoke<MicrophonePermission>("request_microphone_permission");
}

export function openMicrophoneSettings(): Promise<void> {
  return invoke("open_microphone_settings");
}

/** Whether the system has a setting Pragma can open for this state. */
export function canOpenMicrophoneSettings(permission: MicrophonePermission): boolean {
  return permission === "denied" || permission === "restricted";
}
