import darkDefault from "./dark-default.json";
import lightDefault from "./light-default.json";
import tokyoNight from "./tokyo-night.json";
import catppuccin from "./catppuccin.json";
import gruvbox from "./gruvbox.json";
import nord from "./nord.json";
import everforest from "./everforest.json";
import rosePine from "./rose-pine.json";
import paperLight from "./paper-light.json";
import arcticLight from "./arctic-light.json";
import oneDark from "./one-dark.json";
import dracula from "./dracula.json";
import solarizedDark from "./solarized-dark.json";
import solarizedLight from "./solarized-light.json";
import githubDark from "./github-dark.json";
import githubLight from "./github-light.json";
import kanagawa from "./kanagawa.json";
import ayuDark from "./ayu-dark.json";
import ayuLight from "./ayu-light.json";
import catppuccinLatte from "./catppuccin-latte.json";
import gruvboxLight from "./gruvbox-light.json";
import everforestLight from "./everforest-light.json";
import rosePineDawn from "./rose-pine-dawn.json";
import tokyoNightDay from "./tokyo-night-day.json";
import { resolveThemeFile } from "../themeFile";
import { lookupIn } from "../themeFolder";
import type { Theme } from "../types";

const fullThemes = [
  darkDefault,
  lightDefault,
  tokyoNight,
  catppuccin,
  gruvbox,
  nord,
  everforest,
  rosePine,
  paperLight,
  arcticLight,
] as Theme[];

// Written in the short palette format; resolved once at startup.
export const shortThemeFiles: unknown[] = [
  oneDark,
  dracula,
  solarizedDark,
  solarizedLight,
  githubDark,
  githubLight,
  kanagawa,
  ayuDark,
  ayuLight,
  catppuccinLatte,
  gruvboxLight,
  everforestLight,
  rosePineDawn,
  tokyoNightDay,
];

function resolveShortThemes(): Theme[] {
  const lookup = lookupIn(fullThemes);
  return shortThemeFiles.flatMap((file) => {
    const result = resolveThemeFile(file, lookup);
    if (result.ok) return [result.theme];
    console.error("[pragma.theme] built-in theme failed to resolve", result.errors);
    return [];
  });
}

export const builtInThemeList: Theme[] = [...fullThemes, ...resolveShortThemes()];

export const builtInThemes: Record<string, Theme> = Object.fromEntries(
  builtInThemeList.map((theme) => [theme.metadata.id, theme]),
);

export function getBuiltInTheme(id: string): Theme | undefined {
  return builtInThemes[id];
}

export const defaultThemeId = darkDefault.metadata.id;
