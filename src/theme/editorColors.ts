import { generateCssVariables } from "./applyTheme";
import { parseColor } from "./color";
import { ADDITIONAL_ALIASES } from "./cssVariableMap";
import type { CssVariableMapping } from "./tokenResolution";
import type { Theme } from "./types";

export const EDITOR_COLOR_KEYS = [
  "background",
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
] as const;

export type EditorColorKey = (typeof EDITOR_COLOR_KEYS)[number];
export type EditorColorOverrides = Partial<Record<EditorColorKey, string>>;

/** Elements whose colors follow the editor theme instead of the UI theme. */
export const EDITOR_COLOR_SCOPE = ".cm-editor, [data-editor-colors]";

const STYLE_ID = "pragma-editor-colors";
const EDITOR_PREFIXES = ["--editor-", "--syntax-", "--color-editor-", "--color-syntax-"];
const TERMINAL_PREFIXES = ["--terminal-", "--color-terminal-"];

function overrideNames(key: EditorColorKey): string[] {
  if (key === "background") {
    return [
      "--editor-bg",
      ...ADDITIONAL_ALIASES["--editor-bg"],
      "--editor-gutter-bg",
      ...ADDITIONAL_ALIASES["--editor-gutter-bg"],
    ];
  }
  const name = `--syntax-${key}`;
  return [name, ...(ADDITIONAL_ALIASES[name] ?? [])];
}

function pick(theme: Theme, prefixes: string[]): CssVariableMapping[] {
  return generateCssVariables(theme).filter(({ name }) =>
    prefixes.some((prefix) => name.startsWith(prefix)),
  );
}

/**
 * Editor colors that differ from the UI theme: the editor theme's editor and syntax colors,
 * then the single color overrides. Empty when the editor simply follows the UI theme.
 */
export function editorColorVariables(
  editorTheme: Theme | undefined,
  overrides: EditorColorOverrides,
): CssVariableMapping[] {
  const vars = new Map<string, string>();
  if (editorTheme) {
    for (const { name, value } of pick(editorTheme, EDITOR_PREFIXES)) vars.set(name, value);
  }
  for (const key of EDITOR_COLOR_KEYS) {
    const value = overrides[key];
    if (!value || !parseColor(value)) continue;
    for (const name of overrideNames(key)) vars.set(name, value);
  }
  return [...vars].map(([name, value]) => ({ name, value }));
}

/** Terminal colors of another theme; empty when the terminal follows the UI theme. */
export function terminalColorVariables(terminalTheme: Theme | undefined): CssVariableMapping[] {
  return terminalTheme ? pick(terminalTheme, TERMINAL_PREFIXES) : [];
}

function declarations(vars: CssVariableMapping[], important: boolean): string {
  const suffix = important ? " !important" : "";
  return vars.map(({ name, value }) => `  ${name}: ${value}${suffix};`).join("\n");
}

export function editorColorsCss(
  editorVars: CssVariableMapping[],
  terminalVars: CssVariableMapping[],
): string {
  const rules: string[] = [];
  if (editorVars.length > 0) {
    rules.push(`${EDITOR_COLOR_SCOPE} {\n${declarations(editorVars, false)}\n}`);
  }
  // Only terminals read these, so they can win over the theme's inline values on the root.
  if (terminalVars.length > 0) rules.push(`:root {\n${declarations(terminalVars, true)}\n}`);
  return rules.join("\n");
}

export function applyEditorColors(css: string): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}
