import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";

export function useTerminalShellResolver() {
  const shell = useSettingsStore((s) => s.terminal.shell);
  const setTerminalSettings = useSettingsStore((s) => s.setTerminalSettings);
  const setDefaultShell = useTerminalStore((s) => s.setDefaultShell);
  const setShellResolved = useTerminalStore((s) => s.setShellResolved);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    void (async () => {
      try {
        const resolved = await invoke<string>("resolve_terminal_shell", {
          shell: shell.length > 0 ? shell : null,
        });

        if (resolved !== shell) {
          setTerminalSettings({ shell: resolved });
        }
        setDefaultShell(resolved);
      } catch {
        setDefaultShell(shell.length > 0 ? shell : "");
        setShellResolved(true);
      }
    })();
  }, [shell, setTerminalSettings, setDefaultShell, setShellResolved]);
}
