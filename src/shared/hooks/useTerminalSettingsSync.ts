import { useEffect } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";

export function useTerminalSettingsSync() {
  const terminalSettings = useSettingsStore((s) => s.terminal);
  const shellResolved = useTerminalStore((s) => s.shellResolved);
  const setDefaultShell = useTerminalStore((s) => s.setDefaultShell);
  const setFontSize = useTerminalStore((s) => s.setFontSize);
  const setFontFamily = useTerminalStore((s) => s.setFontFamily);
  const setFontId = useTerminalStore((s) => s.setFontId);
  const setScrollback = useTerminalStore((s) => s.setScrollback);
  const setAiSuggestions = useTerminalStore((s) => s.setAiSuggestions);

  useEffect(() => {
    // Only overwrite the resolved default shell when the user has actually
    // configured a non-empty shell. Otherwise an empty default setting can
    // race with shell resolution and leave the terminal with defaultShell="",
    // which prevents Terminal.tsx from creating any session.
    if (shellResolved && terminalSettings.shell.length > 0) {
      setDefaultShell(terminalSettings.shell);
    }
    setFontSize(terminalSettings.fontSize);
    setFontFamily(terminalSettings.fontFamily);
    setFontId(terminalSettings.fontId);
    setScrollback(terminalSettings.scrollback);
    setAiSuggestions(terminalSettings.aiSuggestions);
  }, [
    terminalSettings.shell,
    terminalSettings.fontSize,
    terminalSettings.fontFamily,
    terminalSettings.fontId,
    terminalSettings.scrollback,
    terminalSettings.aiSuggestions,
    shellResolved,
    setDefaultShell,
    setFontSize,
    setFontFamily,
    setFontId,
    setScrollback,
    setAiSuggestions,
  ]);
}
