import type { ITheme } from "@xterm/xterm";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getXtermTheme(): ITheme {
  return {
    background: readCssVar("--terminal-bg", "#0d0e15"),
    foreground: readCssVar("--terminal-fg", "#c0caf5"),
    cursor: readCssVar("--terminal-cursor", "#c0caf5"),
    cursorAccent: readCssVar("--terminal-cursor-accent", "#c0caf5"),
    selectionBackground: readCssVar("--terminal-selection", "#283457"),
    black: readCssVar("--terminal-ansi-black", "#09090b"),
    red: readCssVar("--terminal-ansi-red", "#ef4444"),
    green: readCssVar("--terminal-ansi-green", "#22c55e"),
    yellow: readCssVar("--terminal-ansi-yellow", "#f59e0b"),
    blue: readCssVar("--terminal-ansi-blue", "#2b7fff"),
    magenta: readCssVar("--terminal-ansi-magenta", "#c084fc"),
    cyan: readCssVar("--terminal-ansi-cyan", "#22d3ee"),
    white: readCssVar("--terminal-ansi-white", "#a1a1aa"),
    brightBlack: readCssVar("--terminal-ansi-bright-black", "#27272a"),
    brightRed: readCssVar("--terminal-ansi-bright-red", "#f87171"),
    brightGreen: readCssVar("--terminal-ansi-bright-green", "#4ade80"),
    brightYellow: readCssVar("--terminal-ansi-bright-yellow", "#fbbf24"),
    brightBlue: readCssVar("--terminal-ansi-bright-blue", "#60a5fa"),
    brightMagenta: readCssVar("--terminal-ansi-bright-magenta", "#d8b4fe"),
    brightCyan: readCssVar("--terminal-ansi-bright-cyan", "#67e8f9"),
    brightWhite: readCssVar("--terminal-ansi-bright-white", "#f4f4f5"),
  };
}
