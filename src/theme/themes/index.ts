import warmGraphite from "./warm-graphite.json";
import type { Theme } from "../types";

export const builtInThemes: Record<string, Theme> = {
  [warmGraphite.metadata.id]: warmGraphite as Theme,
};

export const builtInThemeList = Object.values(builtInThemes);

export function getBuiltInTheme(id: string): Theme | undefined {
  return builtInThemes[id];
}

export const defaultThemeId = warmGraphite.metadata.id;
