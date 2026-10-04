import type { ColorTokens, ThemeTokens } from "./types";
import { resolveValue, type CssVariableMapping } from "./tokenResolution";

const SHADCN_ALIASES: Array<[string, (colors: ColorTokens) => string]> = [
  ["--background", (colors) => colors.background.root],
  ["--foreground", (colors) => colors.foreground.default],
  ["--card", (colors) => colors.background.surface],
  ["--card-foreground", (colors) => colors.foreground.default],
  ["--popover", (colors) => colors.background.elevated],
  ["--popover-foreground", (colors) => colors.foreground.default],
  ["--primary", (colors) => colors.accent.default],
  ["--primary-foreground", (colors) => colors.foreground.inverse],
  ["--secondary", (colors) => colors.background.hover],
  ["--secondary-foreground", (colors) => colors.foreground.default],
  ["--muted", (colors) => colors.background.hover],
  ["--muted-foreground", (colors) => colors.foreground.muted],
  ["--accent", (colors) => colors.background.active],
  ["--accent-foreground", (colors) => colors.foreground.default],
  ["--destructive", (colors) => colors.status.error],
  ["--border", (colors) => colors.border.default],
  ["--input", (colors) => colors.border.default],
  ["--ring", (colors) => colors.accent.default],

  ["--sidebar", (colors) => colors.background.root],
  ["--sidebar-foreground", (colors) => colors.foreground.default],
  ["--sidebar-primary", (colors) => colors.accent.default],
  ["--sidebar-primary-foreground", (colors) => colors.foreground.inverse],
  ["--sidebar-accent", (colors) => colors.background.hover],
  ["--sidebar-accent-foreground", (colors) => colors.foreground.default],
  ["--sidebar-border", (colors) => colors.border.default],
  ["--sidebar-ring", (colors) => colors.accent.default],

  ["--chart-1", (colors) => colors.accent.default],
  ["--chart-2", (colors) => colors.status.success],
  ["--chart-3", (colors) => colors.status.warning],
  ["--chart-4", (colors) => colors.status.error],
  ["--chart-5", (colors) => colors.status.info],
];

export function shadcnAliasVariables(tokens: ThemeTokens): CssVariableMapping[] {
  return SHADCN_ALIASES.map(([name, pick]) => ({
    name,
    value: resolveValue(pick(tokens.colors), tokens),
  }));
}
