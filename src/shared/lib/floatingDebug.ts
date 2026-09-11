import { invoke } from "@tauri-apps/api/core";

export function logFloatingDebug(message: string): void {
  console.log(`[floating] ${message}`);
  void invoke<string>("floating_debug_log", { message }).catch((error) => {
    console.error("[floating] log failed", error);
  });
}
