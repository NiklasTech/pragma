import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";

export type NotificationPermission =
  | "granted"
  | "denied"
  | "not-determined"
  | "terminal"
  | "unavailable";

let lastBadgeCount: number | null = null;

/// Each platform names its default notification sound differently.
export function defaultNotificationSound(userAgent: string): string {
  if (/Mac/.test(userAgent)) return "NSUserNotificationDefaultSoundName";
  if (/Windows/.test(userAgent)) return "Default";
  return "message-new-instant";
}

export function readNotificationPermission(): Promise<NotificationPermission> {
  return invoke<NotificationPermission>("notification_permission");
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  return invoke<NotificationPermission>("request_notification_permission");
}

export function openNotificationSettings(): Promise<void> {
  return invoke("open_notification_settings");
}

export async function showSystemNotification(
  title: string,
  body: string,
  playSound: boolean,
): Promise<void> {
  try {
    if ((await requestNotificationPermission()) === "denied") {
      console.warn("System notifications are turned off for Pragma.");
      return;
    }
    const sound = playSound ? defaultNotificationSound(navigator.userAgent) : undefined;
    sendNotification({ title, body, sound });
  } catch (err) {
    console.warn("Failed to show a system notification:", err);
  }
}

export function setAttentionBadge(count: number): void {
  if (count === lastBadgeCount) return;
  lastBadgeCount = count;
  invoke("set_attention_badge", { count }).catch(() => {});
}
