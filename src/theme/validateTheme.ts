import type { Theme, ThemeInput } from "./types";

const FORMAT = "pragma-theme-v1";

const HEX_REGEX = /^#([a-fA-F0-9]{3}|[a-fA-F0-9]{4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/;
const RGBA_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;
const REF_REGEX = /^\{[a-zA-Z0-9_.-]+\}$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isHexOrRgba(value: string): boolean {
  return HEX_REGEX.test(value) || RGBA_REGEX.test(value) || value === "transparent";
}

function isColorValue(value: string): boolean {
  return isHexOrRgba(value) || REF_REGEX.test(value);
}

function addError(errors: string[], path: string, message: string) {
  errors.push(`${path}: ${message}`);
}

function validateString(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!isString(obj[key])) {
    addError(errors, `${path}.${key}`, "must be a string");
  }
}

function validateColor(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void {
  const value = obj[key];
  if (!isString(value)) {
    addError(errors, `${path}.${key}`, "must be a string");
    return;
  }
  if (!isColorValue(value)) {
    addError(errors, `${path}.${key}`, `invalid color value "${value}"`);
  }
}

function validateNumber(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addError(errors, `${path}.${key}`, "must be a finite number");
  }
}

function validateObject(
  errors: string[],
  obj: unknown,
  path: string,
): obj is Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    addError(errors, path, "must be an object");
    return false;
  }
  return true;
}

function validateTokenObject(
  errors: string[],
  obj: unknown,
  path: string,
  requiredKeys: string[],
): void {
  if (!validateObject(errors, obj, path)) return;
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      addError(errors, path, `missing required key "${key}"`);
    }
  }
}

function validateBackgroundTokens(errors: string[], bg: unknown, path: string): void {
  validateTokenObject(errors, bg, path, [
    "root",
    "surface",
    "elevated",
    "input",
    "hover",
    "active",
    "overlay",
  ]);
  if (!validateObject(errors, bg, path)) return;
  for (const key of ["root", "surface", "elevated", "input", "hover", "active", "overlay"]) {
    validateColor(errors, bg, key, path);
  }
}

function validateForegroundTokens(errors: string[], fg: unknown, path: string): void {
  validateTokenObject(errors, fg, path, ["default", "muted", "subtle", "inverse"]);
  if (!validateObject(errors, fg, path)) return;
  for (const key of ["default", "muted", "subtle", "inverse"]) {
    validateColor(errors, fg, key, path);
  }
}

function validateAccentTokens(errors: string[], accent: unknown, path: string): void {
  validateTokenObject(errors, accent, path, ["default", "subtle", "glow"]);
  if (!validateObject(errors, accent, path)) return;
  for (const key of ["default", "subtle", "glow"]) {
    validateColor(errors, accent, key, path);
  }
}

function validateBorderTokens(errors: string[], border: unknown, path: string): void {
  validateTokenObject(errors, border, path, ["default", "subtle", "focus"]);
  if (!validateObject(errors, border, path)) return;
  for (const key of ["default", "subtle", "focus"]) {
    validateColor(errors, border, key, path);
  }
}

function validateStatusTokens(errors: string[], status: unknown, path: string): void {
  validateTokenObject(errors, status, path, [
    "success",
    "successBg",
    "warning",
    "warningBg",
    "error",
    "errorBg",
    "info",
    "infoBg",
  ]);
  if (!validateObject(errors, status, path)) return;
  for (const key of [
    "success",
    "successBg",
    "warning",
    "warningBg",
    "error",
    "errorBg",
    "info",
    "infoBg",
  ]) {
    validateColor(errors, status, key, path);
  }
}

function validateGitTokens(errors: string[], git: unknown, path: string): void {
  validateTokenObject(errors, git, path, [
    "added",
    "addedBg",
    "modified",
    "modifiedBg",
    "deleted",
    "deletedBg",
    "untracked",
    "untrackedBg",
    "ignored",
    "conflict",
  ]);
  if (!validateObject(errors, git, path)) return;
  for (const key of [
    "added",
    "addedBg",
    "modified",
    "modifiedBg",
    "deleted",
    "deletedBg",
    "untracked",
    "untrackedBg",
    "ignored",
    "conflict",
  ]) {
    validateColor(errors, git, key, path);
  }
}

function validateThreadTokens(errors: string[], thread: unknown, path: string): void {
  validateTokenObject(errors, thread, path, ["default", "active"]);
  if (!validateObject(errors, thread, path)) return;
  validateColor(errors, thread, "default", path);
  validateColor(errors, thread, "active", path);
}

function validateScrollbarTokens(errors: string[], scrollbar: unknown, path: string): void {
  validateTokenObject(errors, scrollbar, path, ["track", "thumb", "thumbHover"]);
  if (!validateObject(errors, scrollbar, path)) return;
  validateColor(errors, scrollbar, "track", path);
  validateColor(errors, scrollbar, "thumb", path);
  validateColor(errors, scrollbar, "thumbHover", path);
}

function validateColorTokens(errors: string[], colors: unknown, path: string): void {
  validateTokenObject(errors, colors, path, [
    "background",
    "foreground",
    "accent",
    "border",
    "status",
    "git",
    "thread",
    "selection",
    "scrollbar",
  ]);
  if (!validateObject(errors, colors, path)) return;

  validateBackgroundTokens(errors, colors.background, `${path}.background`);
  validateForegroundTokens(errors, colors.foreground, `${path}.foreground`);
  validateAccentTokens(errors, colors.accent, `${path}.accent`);
  validateBorderTokens(errors, colors.border, `${path}.border`);
  validateStatusTokens(errors, colors.status, `${path}.status`);
  validateGitTokens(errors, colors.git, `${path}.git`);
  validateThreadTokens(errors, colors.thread, `${path}.thread`);
  validateColor(errors, colors, "selection", path);
  validateScrollbarTokens(errors, colors.scrollbar, `${path}.scrollbar`);
}

function validateGutterTokens(errors: string[], gutter: unknown, path: string): void {
  validateTokenObject(errors, gutter, path, ["background", "foreground", "activeBackground"]);
  if (!validateObject(errors, gutter, path)) return;
  validateColor(errors, gutter, "background", path);
  validateColor(errors, gutter, "foreground", path);
  validateColor(errors, gutter, "activeBackground", path);
}

function validateLineTokens(errors: string[], line: unknown, path: string): void {
  validateTokenObject(errors, line, path, ["active", "highlight"]);
  if (!validateObject(errors, line, path)) return;
  validateColor(errors, line, "active", path);
  validateColor(errors, line, "highlight", path);
}

function validateSyntaxTokens(errors: string[], syntax: unknown, path: string): void {
  validateTokenObject(errors, syntax, path, [
    "keyword",
    "string",
    "comment",
    "function",
    "variable",
    "number",
    "type",
    "tag",
    "attribute",
    "property",
    "operator",
  ]);
  if (!validateObject(errors, syntax, path)) return;
  for (const key of [
    "keyword",
    "string",
    "comment",
    "function",
    "variable",
    "number",
    "type",
    "tag",
    "attribute",
    "property",
    "operator",
  ]) {
    validateColor(errors, syntax, key, path);
  }
}

function validateEditorTokens(errors: string[], editor: unknown, path: string): void {
  validateTokenObject(errors, editor, path, [
    "background",
    "foreground",
    "selection",
    "cursor",
    "gutter",
    "line",
    "syntax",
  ]);
  if (!validateObject(errors, editor, path)) return;

  validateColor(errors, editor, "background", path);
  validateColor(errors, editor, "foreground", path);
  validateColor(errors, editor, "selection", path);
  validateColor(errors, editor, "cursor", path);
  validateGutterTokens(errors, editor.gutter, `${path}.gutter`);
  validateLineTokens(errors, editor.line, `${path}.line`);
  validateSyntaxTokens(errors, editor.syntax, `${path}.syntax`);
}

function validateAnsiTokens(errors: string[], ansi: unknown, path: string): void {
  validateTokenObject(errors, ansi, path, [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
  ]);
  if (!validateObject(errors, ansi, path)) return;
  for (const key of ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]) {
    validateColor(errors, ansi, key, path);
  }
}

function validateTerminalTokens(errors: string[], terminal: unknown, path: string): void {
  validateTokenObject(errors, terminal, path, [
    "background",
    "foreground",
    "cursor",
    "cursorAccent",
    "selection",
    "ansi",
    "ansiBright",
  ]);
  if (!validateObject(errors, terminal, path)) return;

  validateColor(errors, terminal, "background", path);
  validateColor(errors, terminal, "foreground", path);
  validateColor(errors, terminal, "cursor", path);
  validateColor(errors, terminal, "cursorAccent", path);
  validateColor(errors, terminal, "selection", path);
  validateAnsiTokens(errors, terminal.ansi, `${path}.ansi`);
  validateAnsiTokens(errors, terminal.ansiBright, `${path}.ansiBright`);
}

function validatePaddingTokens(errors: string[], padding: unknown, path: string): void {
  validateTokenObject(errors, padding, path, ["xs", "sm", "md", "lg"]);
  if (!validateObject(errors, padding, path)) return;
  for (const key of ["xs", "sm", "md", "lg"]) {
    validateNumber(errors, padding, key, path);
  }
}

function validateLayoutTokens(errors: string[], layout: unknown, path: string): void {
  if (!validateObject(errors, layout, path)) return;

  const numericKeys = [
    "headerHeight",
    "tabHeight",
    "statusbarHeight",
    "inputbarHeight",
    "sidebarWidth",
    "sidebarMinWidth",
    "sidebarMaxWidth",
    "panelMinHeight",
    "panelDefaultHeight",
    "rowHeight",
  ];
  for (const key of numericKeys) {
    if (key in layout) validateNumber(errors, layout, key, path);
  }

  if ("padding" in layout) {
    validatePaddingTokens(errors, layout.padding, `${path}.padding`);
  }
}

function validateTypographyLineHeightUiTokens(errors: string[], ui: unknown, path: string): void {
  validateTokenObject(errors, ui, path, ["2xs", "xs", "sm", "base", "md", "lg"]);
  if (!validateObject(errors, ui, path)) return;
  for (const key of ["2xs", "xs", "sm", "base", "md", "lg"]) {
    validateString(errors, ui, key, path);
  }
}

function validateTypographyTokens(errors: string[], typography: unknown, path: string): void {
  if (!validateObject(errors, typography, path)) return;

  if ("ui" in typography) {
    const ui = typography.ui as Record<string, unknown>;
    validateTokenObject(errors, ui, `${path}.ui`, ["2xs", "xs", "sm", "base", "md", "lg"]);
    for (const key of ["2xs", "xs", "sm", "base", "md", "lg"]) {
      validateString(errors, ui, key, `${path}.ui`);
    }
  }

  if ("editor" in typography) validateString(errors, typography, "editor", path);

  if ("lineHeight" in typography) {
    const lineHeight = typography.lineHeight as Record<string, unknown>;
    if ("ui" in lineHeight) {
      validateTypographyLineHeightUiTokens(errors, lineHeight.ui, `${path}.lineHeight.ui`);
    }
    if ("editor" in lineHeight) validateString(errors, lineHeight, "editor", `${path}.lineHeight`);
  }
}

function validateMotionTokens(errors: string[], motion: unknown, path: string): void {
  if (!validateObject(errors, motion, path)) return;

  if ("duration" in motion) {
    const duration = motion.duration as Record<string, unknown>;
    validateTokenObject(errors, duration, `${path}.duration`, ["fast", "base", "slow", "layout"]);
    for (const key of ["fast", "base", "slow", "layout"]) {
      validateString(errors, duration, key, `${path}.duration`);
    }
  }

  if ("ease" in motion) {
    const ease = motion.ease as Record<string, unknown>;
    validateTokenObject(errors, ease, `${path}.ease`, ["default", "out", "inOut", "spring"]);
    for (const key of ["default", "out", "inOut", "spring"]) {
      validateString(errors, ease, key, `${path}.ease`);
    }
  }
}

function validateThemeTokens(errors: string[], tokens: unknown, path: string): void {
  validateTokenObject(errors, tokens, path, ["colors", "editor", "terminal"]);
  if (!validateObject(errors, tokens, path)) return;

  validateColorTokens(errors, (tokens as Record<string, unknown>).colors, `${path}.colors`);
  validateEditorTokens(errors, (tokens as Record<string, unknown>).editor, `${path}.editor`);
  validateTerminalTokens(errors, (tokens as Record<string, unknown>).terminal, `${path}.terminal`);

  if ("layout" in tokens) {
    validateLayoutTokens(errors, (tokens as Record<string, unknown>).layout, `${path}.layout`);
  }
  if ("typography" in tokens) {
    validateTypographyTokens(
      errors,
      (tokens as Record<string, unknown>).typography,
      `${path}.typography`,
    );
  }
  if ("motion" in tokens) {
    validateMotionTokens(errors, (tokens as Record<string, unknown>).motion, `${path}.motion`);
  }
}

export function validateTheme(theme: ThemeInput): ValidationResult {
  const errors: string[] = [];

  if (theme.format !== FORMAT) {
    addError(errors, "format", `must be "${FORMAT}"`);
  }

  if (!validateObject(errors, theme.metadata, "metadata")) {
    return { valid: false, errors };
  }

  validateString(errors, theme.metadata, "id", "metadata");
  validateString(errors, theme.metadata, "name", "metadata");

  if (theme.metadata.id && !/^[a-z0-9-]+$/.test(theme.metadata.id)) {
    addError(errors, "metadata.id", "must contain only lowercase letters, numbers, and hyphens");
  }

  if (!validateObject(errors, theme.appearance, "appearance")) {
    return { valid: false, errors };
  }

  validateString(errors, theme.appearance, "defaultMode", "appearance");
  if (
    theme.appearance.defaultMode &&
    !["dark", "light", "system"].includes(theme.appearance.defaultMode)
  ) {
    addError(errors, "appearance.defaultMode", 'must be "dark", "light", or "system"');
  }

  if (!Array.isArray(theme.appearance.supportedModes)) {
    addError(errors, "appearance.supportedModes", "must be an array");
  } else if (theme.appearance.supportedModes.length === 0) {
    addError(errors, "appearance.supportedModes", "must contain at least one mode");
  }

  validateThemeTokens(errors, theme.tokens, "tokens");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidTheme(theme: ThemeInput): Theme {
  const result = validateTheme(theme);
  if (!result.valid) {
    throw new Error(`Invalid theme: ${result.errors.join("; ")}`);
  }
  return theme as Theme;
}
