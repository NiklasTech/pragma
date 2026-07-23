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
import type { Theme } from "../types";

export const builtInThemes: Record<string, Theme> = {
  [darkDefault.metadata.id]: darkDefault as Theme,
  [lightDefault.metadata.id]: lightDefault as Theme,
  [tokyoNight.metadata.id]: tokyoNight as Theme,
  [catppuccin.metadata.id]: catppuccin as Theme,
  [gruvbox.metadata.id]: gruvbox as Theme,
  [nord.metadata.id]: nord as Theme,
  [everforest.metadata.id]: everforest as Theme,
  [rosePine.metadata.id]: rosePine as Theme,
  [paperLight.metadata.id]: paperLight as Theme,
  [arcticLight.metadata.id]: arcticLight as Theme,
};

export const builtInThemeList = Object.values(builtInThemes);

export function getBuiltInTheme(id: string): Theme | undefined {
  return builtInThemes[id];
}

export const defaultThemeId = darkDefault.metadata.id;
