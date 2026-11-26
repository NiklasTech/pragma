import type { Terminal as XTerm } from "@xterm/xterm";

import { macTerminalKeyAction } from "@/features/terminal/terminalKeymap";
import { copyToClipboard, readFromClipboard } from "@/shared/lib/clipboard";
import { matchShortcut, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";

type CliTerminal = Pick<XTerm, "getSelection" | "paste" | "clear" | "selectAll">;

// ⌘K clears the terminal as in Terminal.app; outside a terminal it still focuses the command line.
const YIELDS_TO_TERMINAL: ReadonlySet<ShortcutActionId> = new Set(["view.focusCommandLine"]);

/// Runs a macOS Terminal.app shortcut in a CLI session; true when the key was handled and xterm must skip it.
export function handleMacCliKey(
  term: CliTerminal,
  event: KeyboardEvent,
  send: (data: string) => void,
  onClear?: () => void,
): boolean {
  if (event.type !== "keydown") return false;
  const action = macTerminalKeyAction(event);
  if (!action) return false;
  const { shortcuts } = useSettingsStore.getState();
  const appShortcut = Object.entries(shortcuts).some(
    ([id, binding]) =>
      !YIELDS_TO_TERMINAL.has(id as ShortcutActionId) && matchShortcut(event, binding),
  );
  if (appShortcut) return false;

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
      onClear?.();
      break;
    case "selectAll":
      term.selectAll();
      break;
    case "send":
      send(action.data);
      break;
  }
  event.preventDefault();
  // The app's own shortcuts listen on the window, so the key stops at the terminal.
  event.stopPropagation();
  return true;
}
