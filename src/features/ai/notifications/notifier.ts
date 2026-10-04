import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let lastBadgeCount: number | null = null;

export async function showSystemNotification(title: string, body: string): Promise<void> {
  try {
    if (!(await isPermissionGranted()) && (await requestPermission()) !== "granted") return;
    sendNotification({ title, body });
  } catch {
    // Notifications are unavailable outside the desktop runtime.
  }
}

export function setAttentionBadge(count: number): void {
  if (count === lastBadgeCount) return;
  lastBadgeCount = count;
  invoke("set_attention_badge", { count }).catch(() => {});
}
