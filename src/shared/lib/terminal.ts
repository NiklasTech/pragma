import { invoke } from "@tauri-apps/api/core";

import { useTerminalStore } from "@/shared/stores/terminal";

export function injectIntoActivePty(command: string): boolean {
  const { lastActiveSessionId } = useTerminalStore.getState();
  if (!lastActiveSessionId) return false;

  void invoke("write_pty", { id: lastActiveSessionId, data: `${command}\n` });
  return true;
}
