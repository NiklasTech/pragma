export type ThemeBase = "dark" | "light";

export interface SimpleThemeFonts {
  editor?: string;
  terminal?: string;
  ui?: string;
}

export interface SimpleTheme {
  name: string;
  base: ThemeBase;
  colors: Record<string, string>;
  fonts?: SimpleThemeFonts;
}

export interface CssVariableMapping {
  name: string;
  value: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const RGB_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;
const HSL_REGEX = /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*[\d.]+\s*)?\)$/;

function isValidColor(value: string): boolean {
  return (
    HEX_REGEX.test(value) ||
    RGB_REGEX.test(value) ||
    HSL_REGEX.test(value) ||
    value === "transparent"
  );
}

const COLOR_KEY_TO_CSS_VAR: Record<string, string> = {
  background: "--bg-root",
  foreground: "--fg-default",
  accent: "--color-accent",
  "accent-subtle": "--color-accent-subtle",
  "accent-glow": "--color-accent-glow",
  "background-root": "--bg-root",
  "background-surface": "--bg-surface",
  "background-elevated": "--bg-elevated",
  "background-input": "--bg-input",
  "background-hover": "--bg-hover",
  "background-active": "--bg-active",
  "background-overlay": "--bg-overlay",
  "foreground-default": "--fg-default",
  "foreground-muted": "--fg-muted",
  "foreground-subtle": "--fg-subtle",
  "foreground-inverse": "--fg-inverse",
  "border-default": "--border-default",
  "border-subtle": "--border-subtle",
  "border-focus": "--border-focus",
  "status-success": "--color-status-success",
  "status-success-bg": "--color-status-success-bg",
  "status-warning": "--color-status-warning",
  "status-warning-bg": "--color-status-warning-bg",
  "status-error": "--color-status-error",
  "status-error-bg": "--color-status-error-bg",
  "status-info": "--color-status-info",
  "status-info-bg": "--color-status-info-bg",
  "git-added": "--color-git-added",
  "git-added-bg": "--color-git-added-bg",
  "git-modified": "--color-git-modified",
  "git-modified-bg": "--color-git-modified-bg",
  "git-deleted": "--color-git-deleted",
  "git-deleted-bg": "--color-git-deleted-bg",
  "git-untracked": "--color-git-untracked",
  "git-untracked-bg": "--color-git-untracked-bg",
  "git-ignored": "--color-git-ignored",
  "git-conflict": "--color-git-conflict",
  selection: "--editor-selection",
  "scrollbar-track": "--scrollbar-track",
  "scrollbar-thumb": "--scrollbar-thumb",
  "scrollbar-thumb-hover": "--scrollbar-thumb-hover",
  "editor-background": "--editor-bg",
  "editor-foreground": "--editor-fg",
  "editor-selection": "--editor-selection",
  "editor-cursor": "--editor-cursor",
  "editor-gutter-background": "--editor-gutter-bg",
  "editor-gutter-foreground": "--editor-gutter-fg",
  "editor-line-active": "--editor-line-active",
  "editor-line-highlight": "--editor-line-highlight",
  "syntax-keyword": "--syntax-keyword",
  "syntax-string": "--syntax-string",
  "syntax-comment": "--syntax-comment",
  "syntax-function": "--syntax-function",
  "syntax-variable": "--syntax-variable",
  "syntax-number": "--syntax-number",
  "syntax-type": "--syntax-type",
  "syntax-tag": "--syntax-tag",
  "syntax-attribute": "--syntax-attribute",
  "syntax-property": "--syntax-property",
  "syntax-operator": "--syntax-operator",
  "terminal-background": "--terminal-bg",
  "terminal-foreground": "--terminal-fg",
  "terminal-cursor": "--terminal-cursor",
  "terminal-cursor-accent": "--terminal-cursor-accent",
  "terminal-selection": "--terminal-selection",
  "terminal-ansi-black": "--terminal-ansi-black",
  "terminal-ansi-red": "--terminal-ansi-red",
  "terminal-ansi-green": "--terminal-ansi-green",
  "terminal-ansi-yellow": "--terminal-ansi-yellow",
  "terminal-ansi-blue": "--terminal-ansi-blue",
  "terminal-ansi-magenta": "--terminal-ansi-magenta",
  "terminal-ansi-cyan": "--terminal-ansi-cyan",
  "terminal-ansi-white": "--terminal-ansi-white",
  "terminal-ansi-bright-black": "--terminal-ansi-bright-black",
  "terminal-ansi-bright-red": "--terminal-ansi-bright-red",
  "terminal-ansi-bright-green": "--terminal-ansi-bright-green",
  "terminal-ansi-bright-yellow": "--terminal-ansi-bright-yellow",
  "terminal-ansi-bright-blue": "--terminal-ansi-bright-blue",
  "terminal-ansi-bright-magenta": "--terminal-ansi-bright-magenta",
  "terminal-ansi-bright-cyan": "--terminal-ansi-bright-cyan",
  "terminal-ansi-bright-white": "--terminal-ansi-bright-white",
};

function mapColorKey(key: string): string {
  const normalized = key.replace(/\./g, "-");
  return COLOR_KEY_TO_CSS_VAR[normalized] ?? `--${normalized}`;
}

export function validateSimpleTheme(theme: unknown): ValidationResult {
  const errors: string[] = [];

  if (!theme || typeof theme !== "object") {
    errors.push("Theme must be an object");
    return { valid: false, errors };
  }

  const t = theme as Record<string, unknown>;

  if (typeof t.name !== "string" || t.name.length === 0) {
    errors.push("name must be a non-empty string");
  }

  if (t.base !== "dark" && t.base !== "light") {
    errors.push('base must be "dark" or "light"');
  }

  if (!t.colors || typeof t.colors !== "object" || Array.isArray(t.colors)) {
    errors.push("colors must be an object");
  } else if (Object.keys(t.colors).length === 0) {
    errors.push("colors must contain at least one color");
  } else {
    for (const [key, value] of Object.entries(t.colors as Record<string, unknown>)) {
      if (typeof value !== "string") {
        errors.push(`colors.${key} must be a string`);
      } else if (!isValidColor(value)) {
        errors.push(`colors.${key} has invalid color value "${value}"`);
      }
    }
  }

  if (t.fonts !== undefined) {
    if (typeof t.fonts !== "object" || Array.isArray(t.fonts)) {
      errors.push("fonts must be an object");
    } else {
      const fonts = t.fonts as Record<string, unknown>;
      for (const key of ["editor", "terminal", "ui"]) {
        if (fonts[key] !== undefined && typeof fonts[key] !== "string") {
          errors.push(`fonts.${key} must be a string`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidSimpleTheme(theme: unknown): SimpleTheme {
  const result = validateSimpleTheme(theme);
  if (!result.valid) {
    throw new Error(`Invalid simple theme: ${result.errors.join("; ")}`);
  }
  return theme as SimpleTheme;
}

export function loadSimpleTheme(input: string): SimpleTheme {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse theme JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return assertValidSimpleTheme(parsed);
}

export function simpleThemeToCssVariables(theme: SimpleTheme): CssVariableMapping[] {
  const mappings: CssVariableMapping[] = [];

  for (const [key, value] of Object.entries(theme.colors)) {
    const varName = mapColorKey(key);
    mappings.push({ name: varName, value });
  }

  if (theme.fonts) {
    if (theme.fonts.ui) {
      mappings.push({ name: "--font-sans", value: theme.fonts.ui });
    }
    if (theme.fonts.editor) {
      mappings.push({ name: "--font-mono", value: theme.fonts.editor });
    }
    if (theme.fonts.terminal) {
      mappings.push({ name: "--font-terminal", value: theme.fonts.terminal });
    }
  }

  return mappings;
}

export function applySimpleTheme(theme: SimpleTheme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const variables = simpleThemeToCssVariables(theme);

  for (const { name, value } of variables) {
    root.style.setProperty(name, value);
  }

  root.classList.remove("dark", "light");
  root.classList.add(theme.base);
}
