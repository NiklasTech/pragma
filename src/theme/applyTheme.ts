import type { Theme, ThemeTokens } from "./types";

const REF_REGEX = /^\{([a-zA-Z0-9_.-]+)\}$/;

export interface CssVariableMapping {
  name: string;
  value: string;
}

function isRef(value: string): boolean {
  return REF_REGEX.test(value);
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveValue(
  value: string,
  tokens: ThemeTokens,
  visited: Set<string> = new Set(),
): string {
  if (!isRef(value)) return value;

  const match = REF_REGEX.exec(value);
  if (!match) return value;

  const path = match[1];
  if (visited.has(path)) {
    console.warn(`[pragma.theme] Circular reference detected: ${value}`);
    return value;
  }

  visited.add(path);
  const resolved = getPath(tokens, path);

  if (typeof resolved !== "string") {
    console.warn(`[pragma.theme] Could not resolve reference: ${value}`);
    return value;
  }

  return resolveValue(resolved, tokens, visited);
}

function flattenTokens(
  prefix: string,
  value: unknown,
  mappings: CssVariableMapping[],
  resolve: (v: string) => string,
): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    mappings.push({ name: prefix, value: resolve(value) });
    return;
  }

  if (typeof value === "number") {
    mappings.push({ name: prefix, value: String(value) });
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPrefix = prefix ? `${prefix}-${toKebab(key)}` : toKebab(key);
      flattenTokens(childPrefix, child, mappings, resolve);
    }
  }
}

function toKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function cssVarName(tokenPath: string): string {
  // Map theme token paths to our CSS variable names.
  // e.g. "colors-background-root" -> "--color-bg-root"
  const mapping = TOKEN_TO_CSS_VAR[tokenPath];
  if (mapping) return mapping;

  // Fallback: derive from path
  return `--${tokenPath}`;
}

const TOKEN_TO_CSS_VAR: Record<string, string> = {
  // Backgrounds
  "colors-background-root": "--color-bg-root",
  "colors-background-surface": "--color-bg-surface",
  "colors-background-elevated": "--color-bg-elevated",
  "colors-background-input": "--color-bg-input",
  "colors-background-hover": "--color-bg-hover",
  "colors-background-active": "--color-bg-active",
  "colors-background-overlay": "--color-bg-overlay",

  // Foregrounds
  "colors-foreground-default": "--color-fg-default",
  "colors-foreground-muted": "--color-fg-muted",
  "colors-foreground-subtle": "--color-fg-subtle",
  "colors-foreground-inverse": "--color-fg-inverse",

  // Accent
  "colors-accent-default": "--color-accent",
  "colors-accent-subtle": "--color-accent-subtle",
  "colors-accent-glow": "--color-accent-glow",

  // Borders
  "colors-border-default": "--color-border",
  "colors-border-subtle": "--color-border-subtle",
  "colors-border-focus": "--color-border-focus",

  // Status
  "colors-status-success": "--color-status-success",
  "colors-status-success-bg": "--color-status-success-bg",
  "colors-status-warning": "--color-status-warning",
  "colors-status-warning-bg": "--color-status-warning-bg",
  "colors-status-error": "--color-status-error",
  "colors-status-error-bg": "--color-status-error-bg",
  "colors-status-info": "--color-status-info",
  "colors-status-info-bg": "--color-status-info-bg",

  // Git
  "colors-git-added": "--color-git-added",
  "colors-git-added-bg": "--color-git-added-bg",
  "colors-git-modified": "--color-git-modified",
  "colors-git-modified-bg": "--color-git-modified-bg",
  "colors-git-deleted": "--color-git-deleted",
  "colors-git-deleted-bg": "--color-git-deleted-bg",
  "colors-git-untracked": "--color-git-untracked",
  "colors-git-untracked-bg": "--color-git-untracked-bg",
  "colors-git-ignored": "--color-git-ignored",
  "colors-git-conflict": "--color-git-conflict",

  // Misc
  "colors-thread-default": "--color-thread",
  "colors-thread-active": "--color-thread-active",
  "colors-selection": "--color-selection",
  "colors-scrollbar-track": "--color-scrollbar-track",
  "colors-scrollbar-thumb": "--color-scrollbar-thumb",
  "colors-scrollbar-thumb-hover": "--color-scrollbar-thumb-hover",

  // Editor
  "editor-background": "--color-editor-bg",
  "editor-foreground": "--color-editor-fg",
  "editor-selection": "--color-editor-selection",
  "editor-cursor": "--color-editor-cursor",
  "editor-gutter-background": "--color-editor-gutter-bg",
  "editor-gutter-foreground": "--color-editor-gutter-fg",
  "editor-gutter-active-background": "--color-editor-gutter-active-bg",
  "editor-line-active": "--color-editor-line-active",
  "editor-line-highlight": "--color-editor-line-highlight",

  // Syntax
  "editor-syntax-keyword": "--color-syntax-keyword",
  "editor-syntax-string": "--color-syntax-string",
  "editor-syntax-comment": "--color-syntax-comment",
  "editor-syntax-function": "--color-syntax-function",
  "editor-syntax-variable": "--color-syntax-variable",
  "editor-syntax-number": "--color-syntax-number",
  "editor-syntax-type": "--color-syntax-type",
  "editor-syntax-tag": "--color-syntax-tag",
  "editor-syntax-attribute": "--color-syntax-attribute",
  "editor-syntax-property": "--color-syntax-property",
  "editor-syntax-operator": "--color-syntax-operator",

  // Terminal
  "terminal-background": "--color-terminal-bg",
  "terminal-foreground": "--color-terminal-fg",
  "terminal-cursor": "--color-terminal-cursor",
  "terminal-cursor-accent": "--color-terminal-cursor-accent",
  "terminal-selection": "--color-terminal-selection",
  "terminal-ansi-black": "--color-terminal-ansi-black",
  "terminal-ansi-red": "--color-terminal-ansi-red",
  "terminal-ansi-green": "--color-terminal-ansi-green",
  "terminal-ansi-yellow": "--color-terminal-ansi-yellow",
  "terminal-ansi-blue": "--color-terminal-ansi-blue",
  "terminal-ansi-magenta": "--color-terminal-ansi-magenta",
  "terminal-ansi-cyan": "--color-terminal-ansi-cyan",
  "terminal-ansi-white": "--color-terminal-ansi-white",
  "terminal-ansi-bright-black": "--color-terminal-ansi-bright-black",
  "terminal-ansi-bright-red": "--color-terminal-ansi-bright-red",
  "terminal-ansi-bright-green": "--color-terminal-ansi-bright-green",
  "terminal-ansi-bright-yellow": "--color-terminal-ansi-bright-yellow",
  "terminal-ansi-bright-blue": "--color-terminal-ansi-bright-blue",
  "terminal-ansi-bright-magenta": "--color-terminal-ansi-bright-magenta",
  "terminal-ansi-bright-cyan": "--color-terminal-ansi-bright-cyan",
  "terminal-ansi-bright-white": "--color-terminal-ansi-bright-white",

  // Layout
  "layout-header-height": "--chrome-header-h",
  "layout-tab-height": "--chrome-tab-h",
  "layout-statusbar-height": "--chrome-statusbar-h",
  "layout-breadcrumb-height": "--chrome-breadcrumb-h",
  "layout-sidebar-width": "--chrome-sidebar-expanded-w",
  "layout-sidebar-collapsed-width": "--chrome-sidebar-collapsed-w",
  "layout-sidebar-min-width": "--chrome-sidebar-min-w",
  "layout-sidebar-max-width": "--chrome-sidebar-max-w",
  "layout-panel-min-height": "--chrome-panel-min-h",
  "layout-panel-default-height": "--chrome-panel-default-h",
  "layout-row-height": "--chrome-row-h",
  "layout-inputbar-height": "--chrome-inputbar-h",

  // Typography
  "typography-ui-2xs": "--text-ui-2xs",
  "typography-ui-xs": "--text-ui-xs",
  "typography-ui-sm": "--text-ui-sm",
  "typography-ui-base": "--text-ui-base",
  "typography-ui-md": "--text-ui-md",
  "typography-ui-lg": "--text-ui-lg",
  "typography-editor": "--text-editor",
  "typography-line-height-ui-2xs": "--leading-ui-2xs",
  "typography-line-height-ui-xs": "--leading-ui-xs",
  "typography-line-height-ui-sm": "--leading-ui-sm",
  "typography-line-height-ui-base": "--leading-ui-base",
  "typography-line-height-ui-md": "--leading-ui-md",
  "typography-line-height-ui-lg": "--leading-ui-lg",
  "typography-line-height-editor": "--leading-editor",

  // Motion
  "motion-duration-fast": "--motion-fast",
  "motion-duration-base": "--motion-base",
  "motion-duration-slow": "--motion-slow",
  "motion-duration-layout": "--motion-layout",
  "motion-ease-default": "--motion-ease",
  "motion-ease-out": "--motion-ease-out",
  "motion-ease-in-out": "--motion-ease-in-out",
  "motion-ease-spring": "--motion-ease-spring",
};

// Additional CSS variables that should receive the same value as another.
const ADDITIONAL_ALIASES: Record<string, string[]> = {
  "--color-editor-bg": ["--editor-background"],
  "--color-editor-fg": ["--editor-foreground"],
  "--color-editor-selection": ["--editor-selection"],
  "--color-editor-cursor": ["--editor-cursor"],
  "--color-editor-gutter-bg": ["--editor-gutter"],
  "--color-editor-gutter-fg": ["--editor-gutter-foreground"],
  "--color-editor-line-active": ["--editor-active-line"],
  "--color-syntax-keyword": ["--editor-keyword"],
  "--color-syntax-string": ["--editor-string"],
  "--color-syntax-comment": ["--editor-comment"],
  "--color-syntax-function": ["--editor-function"],
  "--color-syntax-variable": ["--editor-property"],
  "--color-syntax-number": ["--editor-number"],
  "--color-syntax-type": ["--editor-type"],
  "--color-syntax-tag": ["--editor-tag"],
  "--color-syntax-attribute": ["--editor-attribute"],
  "--color-syntax-property": ["--editor-property"],
  "--color-syntax-operator": ["--editor-operator"],
};

function getResolvedValue(_tokenPath: string, value: string, tokens: ThemeTokens): string {
  return resolveValue(value, tokens);
}

export function generateCssVariables(theme: Theme): CssVariableMapping[] {
  const mappings: CssVariableMapping[] = [];
  const resolve = (value: string) => resolveValue(value, theme.tokens);

  flattenTokens("", theme.tokens, mappings, resolve);

  // Convert flattened paths to CSS variables and add aliases
  const cssVars: CssVariableMapping[] = [];
  const seen = new Set<string>();

  for (const mapping of mappings) {
    const name = cssVarName(mapping.name);
    if (seen.has(name)) continue;
    seen.add(name);
    cssVars.push({ name, value: mapping.value });

    const aliases = ADDITIONAL_ALIASES[name];
    if (aliases) {
      for (const alias of aliases) {
        if (!seen.has(alias)) {
          seen.add(alias);
          cssVars.push({ name: alias, value: mapping.value });
        }
      }
    }
  }

  // shadcn/ui aliases
  cssVars.push({
    name: "--background",
    value: getResolvedValue(
      "colors.background.root",
      theme.tokens.colors.background.root,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--card",
    value: getResolvedValue(
      "colors.background.surface",
      theme.tokens.colors.background.surface,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--card-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--popover",
    value: getResolvedValue(
      "colors.background.elevated",
      theme.tokens.colors.background.elevated,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--popover-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--primary",
    value: getResolvedValue(
      "colors.accent.default",
      theme.tokens.colors.accent.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--primary-foreground",
    value: getResolvedValue(
      "colors.foreground.inverse",
      theme.tokens.colors.foreground.inverse,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--secondary",
    value: getResolvedValue(
      "colors.background.hover",
      theme.tokens.colors.background.hover,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--secondary-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--muted",
    value: getResolvedValue(
      "colors.background.hover",
      theme.tokens.colors.background.hover,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--muted-foreground",
    value: getResolvedValue(
      "colors.foreground.muted",
      theme.tokens.colors.foreground.muted,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--accent",
    value: getResolvedValue(
      "colors.background.active",
      theme.tokens.colors.background.active,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--accent-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--destructive",
    value: getResolvedValue("colors.status.error", theme.tokens.colors.status.error, theme.tokens),
  });
  cssVars.push({
    name: "--border",
    value: getResolvedValue(
      "colors.border.default",
      theme.tokens.colors.border.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--input",
    value: getResolvedValue(
      "colors.border.default",
      theme.tokens.colors.border.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--ring",
    value: getResolvedValue(
      "colors.accent.default",
      theme.tokens.colors.accent.default,
      theme.tokens,
    ),
  });

  cssVars.push({
    name: "--sidebar",
    value: getResolvedValue(
      "colors.background.root",
      theme.tokens.colors.background.root,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-primary",
    value: getResolvedValue(
      "colors.accent.default",
      theme.tokens.colors.accent.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-primary-foreground",
    value: getResolvedValue(
      "colors.foreground.inverse",
      theme.tokens.colors.foreground.inverse,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-accent",
    value: getResolvedValue(
      "colors.background.hover",
      theme.tokens.colors.background.hover,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-accent-foreground",
    value: getResolvedValue(
      "colors.foreground.default",
      theme.tokens.colors.foreground.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-border",
    value: getResolvedValue(
      "colors.border.default",
      theme.tokens.colors.border.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--sidebar-ring",
    value: getResolvedValue(
      "colors.accent.default",
      theme.tokens.colors.accent.default,
      theme.tokens,
    ),
  });

  cssVars.push({
    name: "--chart-1",
    value: getResolvedValue(
      "colors.accent.default",
      theme.tokens.colors.accent.default,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--chart-2",
    value: getResolvedValue(
      "colors.status.success",
      theme.tokens.colors.status.success,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--chart-3",
    value: getResolvedValue(
      "colors.status.warning",
      theme.tokens.colors.status.warning,
      theme.tokens,
    ),
  });
  cssVars.push({
    name: "--chart-4",
    value: getResolvedValue("colors.status.error", theme.tokens.colors.status.error, theme.tokens),
  });
  cssVars.push({
    name: "--chart-5",
    value: getResolvedValue("colors.status.info", theme.tokens.colors.status.info, theme.tokens),
  });

  return cssVars;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const cssVars = generateCssVariables(theme);
  const root = document.documentElement;

  for (const { name, value } of cssVars) {
    root.style.setProperty(name, value);
  }
}

export function clearAppliedTheme(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const cssVars = generateCssVariables({
    format: "pragma-theme-v1",
    metadata: { id: "empty", name: "Empty" },
    appearance: { defaultMode: "dark", supportedModes: ["dark"] },
    tokens: {
      colors: {
        background: {
          root: "",
          surface: "",
          elevated: "",
          input: "",
          hover: "",
          active: "",
          overlay: "",
        },
        foreground: { default: "", muted: "", subtle: "", inverse: "" },
        accent: { default: "", subtle: "", glow: "" },
        border: { default: "", subtle: "", focus: "" },
        status: {
          success: "",
          successBg: "",
          warning: "",
          warningBg: "",
          error: "",
          errorBg: "",
          info: "",
          infoBg: "",
        },
        git: {
          added: "",
          addedBg: "",
          modified: "",
          modifiedBg: "",
          deleted: "",
          deletedBg: "",
          untracked: "",
          untrackedBg: "",
          ignored: "",
          conflict: "",
        },
        thread: { default: "", active: "" },
        selection: "",
        scrollbar: { track: "", thumb: "", thumbHover: "" },
      },
      editor: {
        background: "",
        foreground: "",
        selection: "",
        cursor: "",
        gutter: { background: "", foreground: "", activeBackground: "" },
        line: { active: "", highlight: "" },
        syntax: {
          keyword: "",
          string: "",
          comment: "",
          function: "",
          variable: "",
          number: "",
          type: "",
          tag: "",
          attribute: "",
          property: "",
          operator: "",
        },
      },
      terminal: {
        background: "",
        foreground: "",
        cursor: "",
        cursorAccent: "",
        selection: "",
        ansi: {
          black: "",
          red: "",
          green: "",
          yellow: "",
          blue: "",
          magenta: "",
          cyan: "",
          white: "",
        },
        ansiBright: {
          black: "",
          red: "",
          green: "",
          yellow: "",
          blue: "",
          magenta: "",
          cyan: "",
          white: "",
        },
      },
      layout: {
        headerHeight: 0,
        tabHeight: 0,
        statusbarHeight: 0,
        breadcrumbHeight: 0,
        inputbarHeight: 0,
        sidebarWidth: 0,
        sidebarCollapsedWidth: 0,
        sidebarMinWidth: 0,
        sidebarMaxWidth: 0,
        panelMinHeight: 0,
        panelDefaultHeight: 0,
        rowHeight: 0,
        padding: { xs: 0, sm: 0, md: 0, lg: 0 },
      },
      typography: {
        ui: { "2xs": "", xs: "", sm: "", base: "", md: "", lg: "" },
        editor: "",
        lineHeight: {
          ui: { "2xs": "", xs: "", sm: "", base: "", md: "", lg: "" },
          editor: "",
        },
      },
      motion: {
        duration: { fast: "", base: "", slow: "", layout: "" },
        ease: { default: "", out: "", inOut: "", spring: "" },
      },
    },
  });

  for (const { name } of cssVars) {
    root.style.removeProperty(name);
  }
}
