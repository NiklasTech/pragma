import type { Terminal as XTerm } from "@xterm/xterm";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { matchShortcut, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";

/** Loads Unicode 11 character widths and the WebGL renderer. Call after `term.open()`. */
export function loadRenderAddons(term: XTerm): void {
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = "11";

  try {
    const webgl = new WebglAddon();
    // Disposing the addon on context loss hands rendering back to the DOM renderer.
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch {
    // WebGL is unavailable, so xterm keeps its DOM renderer.
  }
}

/** Lets the given shortcuts reach the app instead of being sent to the shell. */
export function passAppShortcuts(term: XTerm, ids: readonly ShortcutActionId[]): void {
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown") return true;
    const { shortcuts } = useSettingsStore.getState();
    return !ids.some((id) => matchShortcut(event, shortcuts[id]));
  });
}
