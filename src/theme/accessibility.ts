import { generateCssVariables, themeMode } from "./applyTheme";
import {
  contrastRatio,
  ensureContrast,
  formatColor,
  parseColor,
  withAlpha,
  type Rgba,
} from "./color";
import type { SupportedMode, Theme } from "./types";

export type ReduceMotionSetting = "system" | "on" | "off";

export const REDUCE_MOTION_SETTINGS: ReduceMotionSetting[] = ["system", "on", "off"];

export function isReduceMotionSetting(value: unknown): value is ReduceMotionSetting {
  return typeof value === "string" && (REDUCE_MOTION_SETTINGS as string[]).includes(value);
}

/** "system" follows the OS preference; "on" and "off" force it. */
export function effectiveReduceMotion(
  setting: ReduceMotionSetting,
  systemPrefers: boolean,
): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return systemPrefers;
}

// Picked so the five states stay apart under protanopia and deuteranopia; untracked is neutral.
const COLOR_BLIND_STATUS: Record<SupportedMode, Record<string, string>> = {
  dark: {
    added: "#4fa3ff",
    modified: "#e69f00",
    deleted: "#ff8a80",
    untracked: "#ffffff",
    conflict: "#cc79a7",
  },
  light: {
    added: "#3b5bdb",
    modified: "#8a5a00",
    deleted: "#c2185b",
    untracked: "#1a1a1a",
    conflict: "#7a3b8f",
  },
};

const TEXT_CONTRAST = 4.5;

/** The theme with git, diff and status colors that red-green color vision tells apart. */
export function withColorBlindStatus(theme: Theme): Theme {
  const mode = themeMode(theme);
  const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
  const root = parseColor(vars.get("--bg-root") ?? "");
  if (!root) return theme;
  const palette = COLOR_BLIND_STATUS[mode];
  const readable = (hex: string): Rgba =>
    ensureContrast(parseColor(hex) ?? root, [root], TEXT_CONTRAST);
  const color = (key: string) => formatColor(readable(palette[key]));
  const background = (key: string) =>
    formatColor(withAlpha(readable(palette[key]), mode === "dark" ? 0.12 : 0.1));

  const tokens = structuredClone(theme.tokens);
  tokens.colors.status = {
    ...tokens.colors.status,
    success: color("added"),
    successBg: background("added"),
    warning: color("modified"),
    warningBg: background("modified"),
    error: color("deleted"),
    errorBg: background("deleted"),
  };
  tokens.colors.git = {
    ...tokens.colors.git,
    added: color("added"),
    addedBg: background("added"),
    modified: color("modified"),
    modifiedBg: background("modified"),
    deleted: color("deleted"),
    deletedBg: background("deleted"),
    untracked: color("untracked"),
    untrackedBg: background("untracked"),
    conflict: color("conflict"),
  };
  return { ...theme, tokens };
}

const CONTRAST_CHECKS: [string, string, string][] = [
  ["Text", "--fg-default", "--bg-root"],
  ["Editor text", "--editor-fg", "--editor-bg"],
  ["Terminal text", "--terminal-fg", "--terminal-bg"],
];

/** Where a theme misses the 4.5:1 text contrast rule; empty when it passes. */
export function themeContrastIssues(theme: Theme): string[] {
  const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
  const issues: string[] = [];
  for (const [label, fg, bg] of CONTRAST_CHECKS) {
    const text = parseColor(vars.get(fg) ?? "");
    const back = parseColor(vars.get(bg) ?? "");
    if (!text || !back) continue;
    const ratio = contrastRatio(text, back);
    if (ratio < TEXT_CONTRAST) {
      issues.push(`${label} contrast is ${ratio.toFixed(1)}:1, below 4.5:1`);
    }
  }
  return issues;
}
