import { useEffect } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";

export function useTerminalSettingsSync() {
  const terminalSettings = useSettingsStore((s) => s.terminal);
  const shellResolved = useTerminalStore((s) => s.shellResolved);
  const setDefaultShell = useTerminalStore((s) => s.setDefaultShell);
  const setFontSize = useTerminalStore((s) => s.setFontSize);
  const setFontFamily = useTerminalStore((s) => s.setFontFamily);
  const setScrollback = useTerminalStore((s) => s.setScrollback);
  const setAiSuggestions = useTerminalStore((s) => s.setAiSuggestions);

  useEffect(() => {
    if (shellResolved) {
      setDefaultShell(terminalSettings.shell);
    }
    setFontSize(terminalSettings.fontSize);
    setFontFamily(terminalSettings.fontFamily);
    setScrollback(terminalSettings.scrollback);
    setAiSuggestions(terminalSettings.aiSuggestions);
  }, [
    terminalSettings.shell,
    terminalSettings.fontSize,
    terminalSettings.fontFamily,
    terminalSettings.scrollback,
    terminalSettings.aiSuggestions,
    shellResolved,
    setDefaultShell,
    setFontSize,
    setFontFamily,
    setScrollback,
    setAiSuggestions,
  ]);
}
