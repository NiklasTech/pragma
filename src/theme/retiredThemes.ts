import type { SupportedMode } from "./types";

/** Themes Pragma bundled before it shipped only Pragma Dark and Light, by their mode. */
const RETIRED_THEME_MODES = new Map<string, SupportedMode>(
  Object.entries({
    "arctic-light": "light",
    "ayu-dark": "dark",
    "ayu-light": "light",
    catppuccin: "dark",
    "catppuccin-latte": "light",
    dracula: "dark",
    everforest: "dark",
    "everforest-light": "light",
    "github-dark": "dark",
    "github-light": "light",
    gruvbox: "dark",
    "gruvbox-light": "light",
    kanagawa: "dark",
    nord: "dark",
    "one-dark": "dark",
    "paper-light": "light",
    "rose-pine": "dark",
    "rose-pine-dawn": "light",
    "solarized-dark": "dark",
    "solarized-light": "light",
    "tokyo-night": "dark",
    "tokyo-night-day": "light",
  } satisfies Record<string, SupportedMode>),
);

/** Pragma Dark or Light for a retired theme of the same mode; any other id stays as it is. */
export function replaceRetiredTheme(id: string): string {
  const mode = RETIRED_THEME_MODES.get(id);
  if (!mode) return id;
  return mode === "dark" ? "dark-default" : "light-default";
}

export const RETIRED_THEME_IDS: readonly string[] = [...RETIRED_THEME_MODES.keys()];
