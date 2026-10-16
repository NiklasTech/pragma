import { themeMode } from "./applyTheme";
import { contrastRatio, ensureContrast, formatColor, parseColor } from "./color";
import { accentTints } from "./palette";
import { resolveValue } from "./tokenResolution";
import type { Theme } from "./types";

export const ACCENT_PRESETS = [
  "#2f9bff",
  "#6e7bf2",
  "#a78bfa",
  "#f472b6",
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
];

const TEXT_ON_ACCENT = 4.5;
const ACCENT_ON_BACKGROUND = 3;

export interface ReadableAccent {
  color: string;
  /** The color was lightened or darkened to stay readable. */
  adjusted: boolean;
}

/**
 * Adjusts an accent color so text on accent buttons keeps 4.5:1 and the accent itself
 * stands out from the background with 3:1. Null for values that are not colors.
 */
export function readableAccent(theme: Theme, value: string): ReadableAccent | null {
  const parsed = parseColor(value);
  if (!parsed) return null;
  const { tokens } = theme;
  const root = parseColor(resolveValue(tokens.colors.background.root, tokens));
  const onAccent = parseColor(resolveValue(tokens.colors.foreground.inverse, tokens));
  if (!root || !onAccent) return null;

  const requested = { ...parsed, a: 1 };
  const passes = (c: string) => {
    const rounded = parseColor(c);
    return (
      rounded !== null &&
      contrastRatio(onAccent, rounded) >= TEXT_ON_ACCENT &&
      contrastRatio(rounded, root) >= ACCENT_ON_BACKGROUND
    );
  };
  let color = formatColor(requested);
  // The margin keeps the ratios above the minimum after rounding to #rrggbb.
  for (let margin = 0; !passes(color) && margin <= 0.5; margin += 0.05) {
    let accent = ensureContrast(requested, [onAccent], TEXT_ON_ACCENT + margin);
    accent = ensureContrast(accent, [root], ACCENT_ON_BACKGROUND + margin);
    color = formatColor(accent);
  }
  return { color, adjusted: color !== formatColor(requested) };
}

/** The theme with another accent and the accent shades derived from it. */
export function withAccent(theme: Theme, value: string): Theme {
  const readable = readableAccent(theme, value);
  if (!readable) return theme;
  const accent = parseColor(readable.color);
  if (!accent) return theme;

  const tints = accentTints(accent, themeMode(theme));
  const tokens = structuredClone(theme.tokens);
  tokens.colors.accent = { default: readable.color, subtle: tints.subtle, glow: tints.glow };
  tokens.colors.border.focus = tints.focus;
  tokens.colors.selection = tints.selection;
  tokens.colors.background.active = tints.active;
  tokens.editor.line.highlight = tints.lineHighlight;
  return { ...theme, tokens };
}
