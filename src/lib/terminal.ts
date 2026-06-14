import { invoke } from "@tauri-apps/api/core";

import { useTerminalStore } from "@/stores/terminal";

export function injectIntoActivePty(command: string): boolean {
  const { activeSessionId } = useTerminalStore.getState();
  if (!activeSessionId) return false;

  void invoke("write_pty", { id: activeSessionId, data: `${command}\n` });
  return true;
}
