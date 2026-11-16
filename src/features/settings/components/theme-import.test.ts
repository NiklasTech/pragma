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

const pragmaLight = builtInThemeList.find(
  (theme) => theme.metadata.id === "light-default",
) as Theme;

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
      metadata: { id: "my-light", name: "My Light" },
      extends: "light-default",
    });
    const result = parseThemeImport(content, builtInThemeList);
    expect(result.ok && result.theme.tokens.colors.background.root).toBe(
      pragmaLight.tokens.colors.background.root,
    );
  });
});

describe("duplicate and export", () => {
  it("duplicates a theme as a file that extends it", () => {
    const copy = duplicateThemeFile(pragmaLight, new Set(["light-default"]), new Set());
    expect(copy.id).toBe("light-default-copy");
    expect(copy.fileName).toBe("light-default-copy.json");
    expect(JSON.parse(copy.content)).toEqual({
      format: "pragma-theme-v1",
      metadata: { id: "light-default-copy", name: "Pragma Light Copy" },
      extends: "light-default",
      tokens: {},
    });
  });

  it("picks a free id when a copy already exists", () => {
    const copy = duplicateThemeFile(
      pragmaLight,
      new Set(["light-default-copy"]),
      new Set(["light-default-copy-2.json"]),
    );
    expect(copy.id).toBe("light-default-copy-3");
  });

  it("exports a folder theme as written and other themes in full", () => {
    const entry = { fileName: "x.json", content: '{"extends":"light-default"}', errors: [] };
    expect(exportThemeContent(pragmaLight, entry)).toBe('{"extends":"light-default"}');

    const exported = JSON.parse(exportThemeContent(pragmaLight, undefined)) as Theme;
    expect(exported.metadata.id).toBe("light-default");
    expect(validateTheme(exported).errors).toEqual([]);
  });
});
