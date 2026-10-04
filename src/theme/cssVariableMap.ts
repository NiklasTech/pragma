export function cssVarName(tokenPath: string): string {
  // Map theme token paths to our CSS variable names.
  // e.g. "colors-background-root" -> "--bg-root"
  const mapping = TOKEN_TO_CSS_VAR[tokenPath];
  if (mapping) return mapping;

  // Fallback: derive from path
  return `--${tokenPath}`;
}
const TOKEN_TO_CSS_VAR: Record<string, string> = {
  // Backgrounds
  "colors-background-chrome": "--bg-chrome",
  "colors-background-root": "--bg-root",
  "colors-background-surface": "--bg-surface",
  "colors-background-elevated": "--bg-elevated",
  "colors-background-input": "--bg-input",
  "colors-background-hover": "--bg-hover",
  "colors-background-active": "--bg-active",
  "colors-background-overlay": "--bg-overlay",

  // Foregrounds
  "colors-foreground-default": "--fg-default",
  "colors-foreground-muted": "--fg-muted",
  "colors-foreground-subtle": "--fg-subtle",
  "colors-foreground-inverse": "--fg-inverse",

  // Accent
  "colors-accent-default": "--color-accent",
  "colors-accent-subtle": "--color-accent-subtle",
  "colors-accent-glow": "--color-accent-glow",

  // Borders
  "colors-border-default": "--border-default",
  "colors-border-subtle": "--border-subtle",
  "colors-border-focus": "--border-focus",

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
  "colors-selection": "--editor-selection",
  "colors-scrollbar-track": "--scrollbar-track",
  "colors-scrollbar-thumb": "--scrollbar-thumb",
  "colors-scrollbar-thumb-hover": "--scrollbar-thumb-hover",

  // Editor
  "editor-background": "--editor-bg",
  "editor-foreground": "--editor-fg",
  "editor-selection": "--editor-selection",
  "editor-cursor": "--editor-cursor",
  "editor-gutter-background": "--editor-gutter-bg",
  "editor-gutter-foreground": "--editor-gutter-fg",
  "editor-gutter-active-background": "--editor-gutter-active-bg",
  "editor-line-active": "--editor-line-active",
  "editor-line-highlight": "--editor-line-highlight",

  // Syntax
  "editor-syntax-keyword": "--syntax-keyword",
  "editor-syntax-string": "--syntax-string",
  "editor-syntax-comment": "--syntax-comment",
  "editor-syntax-function": "--syntax-function",
  "editor-syntax-variable": "--syntax-variable",
  "editor-syntax-number": "--syntax-number",
  "editor-syntax-type": "--syntax-type",
  "editor-syntax-tag": "--syntax-tag",
  "editor-syntax-attribute": "--syntax-attribute",
  "editor-syntax-property": "--syntax-property",
  "editor-syntax-operator": "--syntax-operator",

  // Terminal
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

  // Shadows
  "shadows-sm": "--shadow-sm",
  "shadows-md": "--shadow-md",
};

// Layout dimensions are unitless numbers in theme tokens; CSS lengths need a unit.
const TOKEN_UNITS: Record<string, string> = {
  "layout-header-height": "px",
  "layout-tab-height": "px",
  "layout-statusbar-height": "px",
  "layout-breadcrumb-height": "px",
  "layout-sidebar-width": "px",
  "layout-sidebar-collapsed-width": "px",
  "layout-sidebar-min-width": "px",
  "layout-sidebar-max-width": "px",
  "layout-panel-min-height": "px",
  "layout-panel-default-height": "px",
  "layout-row-height": "px",
  "layout-inputbar-height": "px",
};

export function withTokenUnit(tokenPath: string, value: string): string {
  const unit = TOKEN_UNITS[tokenPath];
  if (!unit || !/^\d+(\.\d+)?$/.test(value)) return value;
  return `${value}${unit}`;
}

// Additional CSS variables that should receive the same value as another.
export const ADDITIONAL_ALIASES: Record<string, string[]> = {
  "--editor-bg": ["--editor-background", "--color-editor-bg"],
  "--editor-fg": ["--editor-foreground", "--color-editor-fg"],
  "--editor-selection": ["--color-editor-selection"],
  "--editor-cursor": ["--color-editor-cursor"],
  "--editor-gutter-bg": ["--editor-gutter", "--color-editor-gutter-bg"],
  "--editor-gutter-fg": ["--editor-gutter-foreground", "--color-editor-gutter-fg"],
  "--editor-line-active": ["--editor-active-line", "--color-editor-line-active"],
  "--editor-line-highlight": ["--color-editor-line-highlight"],
  "--syntax-keyword": ["--editor-keyword", "--color-syntax-keyword"],
  "--syntax-string": ["--editor-string", "--color-syntax-string"],
  "--syntax-comment": ["--editor-comment", "--color-syntax-comment"],
  "--syntax-function": ["--editor-function", "--color-syntax-function"],
  "--syntax-variable": ["--editor-property", "--color-syntax-variable"],
  "--syntax-number": ["--editor-number", "--color-syntax-number"],
  "--syntax-type": ["--editor-type", "--color-syntax-type"],
  "--syntax-tag": ["--editor-tag", "--color-syntax-tag"],
  "--syntax-attribute": ["--editor-attribute", "--color-syntax-attribute"],
  "--syntax-property": ["--color-syntax-property"],
  "--syntax-operator": ["--editor-operator", "--color-syntax-operator"],
  "--bg-root": ["--color-bg-root"],
  "--bg-surface": ["--color-bg-surface"],
  "--bg-elevated": ["--color-bg-elevated"],
  "--bg-input": ["--color-bg-input"],
  "--bg-hover": ["--color-bg-hover"],
  "--bg-active": ["--color-bg-active"],
  "--bg-overlay": ["--color-bg-overlay"],
  "--fg-default": ["--color-fg-default"],
  "--fg-muted": ["--color-fg-muted"],
  "--fg-subtle": ["--color-fg-subtle"],
  "--fg-inverse": ["--color-fg-inverse"],
  "--terminal-bg": ["--color-terminal-bg"],
  "--terminal-fg": ["--color-terminal-fg"],
};
