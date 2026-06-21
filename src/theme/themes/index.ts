import darkDefault from "./dark-default.json";
import lightDefault from "./light-default.json";
import tokyoNight from "./tokyo-night.json";
import catppuccin from "./catppuccin.json";
import gruvbox from "./gruvbox.json";
import type { Theme } from "../types";

export const builtInThemes: Record<string, Theme> = {
  [darkDefault.metadata.id]: darkDefault as Theme,
  [lightDefault.metadata.id]: lightDefault as Theme,
  [tokyoNight.metadata.id]: tokyoNight as Theme,
  [catppuccin.metadata.id]: catppuccin as Theme,
  [gruvbox.metadata.id]: gruvbox as Theme,
};

export const builtInThemeList = Object.values(builtInThemes);

export function getBuiltInTheme(id: string): Theme | undefined {
  return builtInThemes[id];
}

export const defaultThemeId = darkDefault.metadata.id;
