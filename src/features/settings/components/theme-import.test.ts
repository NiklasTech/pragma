import { describe, expect, it } from "vite-plus/test";
import darkDefault from "@/theme/themes/dark-default.json";
import { builtInThemeList } from "@/theme";
import { validateTheme } from "@/theme/validateTheme";
import { parseThemeImport, themeImportErrorLines } from "./theme-import";

function themeJson(edit: (theme: Record<string, unknown>) => void): string {
  const theme = structuredClone(darkDefault) as unknown as Record<string, unknown>;
  edit(theme);
  return JSON.stringify(theme);
}

describe("theme import", () => {
  it("accepts every built-in theme", () => {
    for (const theme of builtInThemeList) {
      expect(validateTheme(theme).errors).toEqual([]);
    }
  });

  it("drops layout, typography and motion from older theme files", () => {
    const result = parseThemeImport(
      themeJson((theme) => {
        const tokens = theme.tokens as Record<string, unknown>;
        tokens.layout = { tabHeight: 4 };
        tokens.typography = { editor: "2px" };
        tokens.motion = { duration: { fast: "5s" } };
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.theme.tokens).sort()).toEqual([
      "colors",
      "editor",
      "shadows",
      "terminal",
    ]);
  });

  it("reports validation errors with their path", () => {
    const result = parseThemeImport(
      themeJson((theme) => {
        const colors = (theme.tokens as { colors: { accent: Record<string, string> } }).colors;
        colors.accent.default = "not-a-color";
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: ['tokens.colors.accent.default: invalid color value "not-a-color"'],
    });
  });

  it("reports a file that is not JSON", () => {
    expect(parseThemeImport("{ nope")).toEqual({
      ok: false,
      errors: ["The file is not valid JSON."],
    });
  });

  it("shows the first three errors and counts the rest", () => {
    expect(themeImportErrorLines(["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "and 2 more"]);
    expect(themeImportErrorLines(["a"])).toEqual(["a"]);
  });
});
