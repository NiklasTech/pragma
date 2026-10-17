import type { Terminal as XTerm } from "@xterm/xterm";

import { macTerminalKeyAction } from "@/features/terminal/terminalKeymap";
import { copyToClipboard, readFromClipboard } from "@/shared/lib/clipboard";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";

type CliTerminal = Pick<XTerm, "getSelection" | "paste" | "clear" | "selectAll">;

/// Runs a macOS Terminal.app shortcut in a CLI session; true when the key was handled and xterm must skip it.
export function handleMacCliKey(
  term: CliTerminal,
  event: KeyboardEvent,
  send: (data: string) => void,
): boolean {
  if (event.type !== "keydown") return false;
  const action = macTerminalKeyAction(event);
  if (!action) return false;
  const { shortcuts } = useSettingsStore.getState();
  if (Object.values(shortcuts).some((binding) => matchShortcut(event, binding))) return false;

  switch (action.type) {
    case "copy": {
      const selection = term.getSelection();
      if (!selection) return false;
      void copyToClipboard(selection);
      break;
    }
    case "paste":
      void readFromClipboard().then((text) => {
        if (text) term.paste(text);
      });
      break;
    case "clear":
      term.clear();
      break;
    case "selectAll":
      term.selectAll();
      break;
    case "send":
      send(action.data);
      break;
  }
  event.preventDefault();
  return true;
}
