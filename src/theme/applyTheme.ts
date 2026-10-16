import type { SupportedMode, Theme } from "./types";
import { FIXED_TOKENS } from "./fixedTokens";
import { ADDITIONAL_ALIASES, cssVarName, withTokenUnit } from "./cssVariableMap";
import { shadcnAliasVariables } from "./shadcnAliases";
import { flattenTokens, resolveValue, type CssVariableMapping } from "./tokenResolution";

export type { CssVariableMapping };

export function generateCssVariables(theme: Theme): CssVariableMapping[] {
  const mappings: CssVariableMapping[] = [];
  const resolve = (value: string) => resolveValue(value, theme.tokens);

  // Picked explicitly so layout, typography and motion in older theme files stay ignored.
  const { colors, editor, terminal, shadows } = theme.tokens;
  flattenTokens("", { colors, editor, terminal, ...FIXED_TOKENS, shadows }, mappings, resolve);

  // Convert flattened paths to CSS variables and add aliases
  const cssVars: CssVariableMapping[] = [];
  const seen = new Set<string>();

  for (const mapping of mappings) {
    const name = cssVarName(mapping.name);
    if (seen.has(name)) continue;
    seen.add(name);
    const value = withTokenUnit(mapping.name, mapping.value);
    cssVars.push({ name, value });

    const aliases = ADDITIONAL_ALIASES[name];
    if (aliases) {
      for (const alias of aliases) {
        if (!seen.has(alias)) {
          seen.add(alias);
          cssVars.push({ name: alias, value });
        }
      }
    }
  }

  // Custom themes without a frame color still need one, or the previous theme's value would stick.
  if (!seen.has("--bg-chrome")) {
    cssVars.push({
      name: "--bg-chrome",
      value: `color-mix(in oklab, ${resolve(theme.tokens.colors.background.root)} 88%, black)`,
    });
  }

  cssVars.push(...shadcnAliasVariables(theme.tokens));

  return cssVars;
}

export function themeMode(theme: Theme): SupportedMode {
  const { defaultMode, supportedModes } = theme.appearance;
  if (defaultMode === "dark" || defaultMode === "light") return defaultMode;
  return supportedModes[0] ?? "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const cssVars = generateCssVariables(theme);
  const root = document.documentElement;

  for (const { name, value } of cssVars) {
    root.style.setProperty(name, value);
  }

  root.classList.remove("dark", "light");
  root.classList.add(themeMode(theme));
}
