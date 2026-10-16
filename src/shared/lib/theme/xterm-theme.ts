import type { ITheme } from "@xterm/xterm";
import { formatColor, parseColor, withAlpha } from "@/theme/color";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** The terminal background, translucent when the background setting lets it show through. */
function terminalBackground(): string {
  const background = readCssVar("--terminal-bg", "#0b0d10");
  const alpha = Number(readCssVar("--terminal-surface-alpha", "1"));
  const parsed = parseColor(background);
  if (!parsed || !Number.isFinite(alpha) || alpha >= 1) return background;
  return formatColor(withAlpha(parsed, Math.max(0, alpha)));
}

/** xterm only draws translucent backgrounds when created with allowTransparency. */
export function terminalAllowsTransparency(): boolean {
  return Number(readCssVar("--terminal-surface-alpha", "1")) < 1;
}

export function getXtermTheme(): ITheme {
  return {
    background: terminalBackground(),
    foreground: readCssVar("--terminal-fg", "#e8eaee"),
    cursor: readCssVar("--terminal-cursor", "#6e7bf2"),
    cursorAccent: readCssVar("--terminal-cursor-accent", "#6e7bf2"),
    selectionBackground: readCssVar("--terminal-selection", "rgba(110, 123, 242, 0.25)"),
    black: readCssVar("--terminal-ansi-black", "#0b0d10"),
    red: readCssVar("--terminal-ansi-red", "#e35d6a"),
    green: readCssVar("--terminal-ansi-green", "#3fb68b"),
    yellow: readCssVar("--terminal-ansi-yellow", "#e0a94e"),
    blue: readCssVar("--terminal-ansi-blue", "#6e7bf2"),
    magenta: readCssVar("--terminal-ansi-magenta", "#a78bfa"),
    cyan: readCssVar("--terminal-ansi-cyan", "#4ec9d8"),
    white: readCssVar("--terminal-ansi-white", "#9ba3af"),
    brightBlack: readCssVar("--terminal-ansi-bright-black", "#2a2f3a"),
    brightRed: readCssVar("--terminal-ansi-bright-red", "#ed7f8b"),
    brightGreen: readCssVar("--terminal-ansi-bright-green", "#5fcfa5"),
    brightYellow: readCssVar("--terminal-ansi-bright-yellow", "#edbf72"),
    brightBlue: readCssVar("--terminal-ansi-bright-blue", "#8b96f6"),
    brightMagenta: readCssVar("--terminal-ansi-bright-magenta", "#bba5f9"),
    brightCyan: readCssVar("--terminal-ansi-bright-cyan", "#7adbe7"),
    brightWhite: readCssVar("--terminal-ansi-bright-white", "#e8eaee"),
  };
}
