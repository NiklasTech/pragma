import { describe, expect, it } from "vite-plus/test";
import darkDefault from "@/theme/themes/dark-default.json";
import { builtInThemeList } from "@/theme";
import type { Theme } from "@/theme/types";
import { validateTheme } from "@/theme/validateTheme";
import { duplicateThemeFile, exportThemeContent, parseThemeImport } from "./theme-import";

function themeJson(edit: (theme: Record<string, unknown>) => void): string {
  const theme = structuredClone(darkDefault) as unknown as Record<string, unknown>;
  edit(theme);
  return JSON.stringify(theme);
}

const nord = builtInThemeList.find((theme) => theme.metadata.id === "nord") as Theme;

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
      builtInThemeList,
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
      builtInThemeList,
    );

    expect(result).toEqual({
      ok: false,
      errors: ['tokens.colors.accent.default: invalid color value "not-a-color"'],
    });
  });

  it("reports a file that is not JSON", () => {
    expect(parseThemeImport("{ nope", builtInThemeList)).toEqual({
      ok: false,
      errors: ["The file is not valid JSON."],
    });
  });

  it("imports a theme that extends a known theme", () => {
    const content = JSON.stringify({
      format: "pragma-theme-v1",
      metadata: { id: "my-nord", name: "My Nord" },
      extends: "nord",
    });
    const result = parseThemeImport(content, builtInThemeList);
    expect(result.ok && result.theme.tokens.colors.background.root).toBe(
      nord.tokens.colors.background.root,
    );
  });
});

describe("duplicate and export", () => {
  it("duplicates a theme as a file that extends it", () => {
    const copy = duplicateThemeFile(nord, new Set(["nord"]), new Set());
    expect(copy.id).toBe("nord-copy");
    expect(copy.fileName).toBe("nord-copy.json");
    expect(JSON.parse(copy.content)).toEqual({
      format: "pragma-theme-v1",
      metadata: { id: "nord-copy", name: "Nord Copy" },
      extends: "nord",
      tokens: {},
    });
  });

  it("picks a free id when a copy already exists", () => {
    const copy = duplicateThemeFile(nord, new Set(["nord-copy"]), new Set(["nord-copy-2.json"]));
    expect(copy.id).toBe("nord-copy-3");
  });

  it("exports a folder theme as written and other themes in full", () => {
    const entry = { fileName: "x.json", content: '{"extends":"nord"}', errors: [] };
    expect(exportThemeContent(nord, entry)).toBe('{"extends":"nord"}');

    const exported = JSON.parse(exportThemeContent(nord, undefined)) as Theme;
    expect(exported.metadata.id).toBe("nord");
    expect(validateTheme(exported).errors).toEqual([]);
  });
});
