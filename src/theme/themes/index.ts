import darkDefault from "./dark-default.json";
import lightDefault from "./light-default.json";
import highContrastDark from "./high-contrast-dark.json";
import highContrastLight from "./high-contrast-light.json";
import { resolveThemeFile } from "../themeFile";
import { lookupIn } from "../themeFolder";
import type { Theme } from "../types";

const pragmaThemes = [darkDefault, lightDefault] as Theme[];

// Written in the short palette format on top of the Pragma themes; resolved once at startup.
export const highContrastThemeFiles: unknown[] = [highContrastDark, highContrastLight];

function resolveHighContrastThemes(): Theme[] {
  const lookup = lookupIn(pragmaThemes);
  return highContrastThemeFiles.flatMap((file) => {
    const result = resolveThemeFile(file, lookup);
    if (result.ok) return [result.theme];
    console.error("[pragma.theme] built-in theme failed to resolve", result.errors);
    return [];
  });
}

export const builtInThemeList: Theme[] = [...pragmaThemes, ...resolveHighContrastThemes()];

export const builtInThemes: Record<string, Theme> = Object.fromEntries(
  builtInThemeList.map((theme) => [theme.metadata.id, theme]),
);

export function getBuiltInTheme(id: string): Theme | undefined {
  return builtInThemes[id];
}

export const defaultThemeId = darkDefault.metadata.id;
