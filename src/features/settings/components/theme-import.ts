import { validateTheme } from "@/theme/validateTheme";
import type { Theme, ThemeInput } from "@/theme/types";

const SHOWN_ERRORS = 3;

export type ThemeImportResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

export function parseThemeImport(content: string): ThemeImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, errors: ["The file does not contain a theme object."] };
  }

  const result = validateTheme(parsed as ThemeInput);
  if (!result.valid) return { ok: false, errors: result.errors };

  const theme = parsed as Theme;
  // Older theme files may still carry sizes, fonts and motion; themes only define colors now.
  const { colors, editor, terminal, shadows } = theme.tokens;
  return { ok: true, theme: { ...theme, tokens: { colors, editor, terminal, shadows } } };
}

export function themeImportErrorLines(errors: string[]): string[] {
  const shown = errors.slice(0, SHOWN_ERRORS);
  const hidden = errors.length - shown.length;
  return hidden > 0 ? [...shown, `and ${hidden} more`] : shown;
}
