import { describe, expect, it } from "vite-plus/test";
import { loadThemeFolder, themeErrorLines, type ThemeFileSource } from "./themeFolder";
import { builtInThemeList } from "./themes";

const reserved = new Set(builtInThemeList.map((theme) => theme.metadata.id));

function file(fileName: string, body: Record<string, unknown>): ThemeFileSource {
  return { fileName, content: JSON.stringify({ format: "pragma-theme-v1", ...body }) };
}

function extending(id: string, base: string, accent?: string): Record<string, unknown> {
  return {
    metadata: { id, name: id },
    extends: base,
    ...(accent ? { tokens: { colors: { accent: { default: accent } } } } : {}),
  };
}

describe("themes folder loader", () => {
  it("lets files extend built-in themes and each other", () => {
    const entries = loadThemeFolder(
      [file("b.json", extending("b", "a", "#00ff00")), file("a.json", extending("a", "nord"))],
      builtInThemeList,
      reserved,
      {},
    );
    expect(entries["a.json"].errors).toEqual([]);
    expect(entries["b.json"].errors).toEqual([]);
    expect(entries["b.json"].theme?.tokens.colors.accent.default).toBe("#00ff00");
  });

  it("reports cycles", () => {
    const entries = loadThemeFolder(
      [file("a.json", extending("a", "b")), file("b.json", extending("b", "a"))],
      builtInThemeList,
      reserved,
      {},
    );
    expect(entries["a.json"].theme).toBeUndefined();
    expect(entries["a.json"].errors[0]).toMatch(/^extends: /);
    expect(entries["b.json"].errors[0]).toMatch(/^extends: /);
  });

  it("rejects ids of built-in themes and ids used twice", () => {
    const entries = loadThemeFolder(
      [
        file("a.json", extending("nord", "dark-default")),
        file("b.json", extending("mine", "nord")),
        file("c.json", extending("mine", "nord")),
      ],
      builtInThemeList,
      reserved,
      {},
    );
    expect(entries["a.json"].errors).toEqual([
      'metadata.id: "nord" is already used by a built-in theme',
    ]);
    expect(entries["b.json"].errors).toEqual([]);
    expect(entries["c.json"].errors).toEqual(['metadata.id: "mine" is already used by b.json']);
  });

  it("keeps the last valid version while a file has errors", () => {
    const first = loadThemeFolder(
      [file("a.json", extending("a", "nord", "#00ff00"))],
      builtInThemeList,
      reserved,
      {},
    );
    const broken = loadThemeFolder(
      [{ fileName: "a.json", content: "{ half-saved" }],
      builtInThemeList,
      reserved,
      first,
    );
    expect(broken["a.json"].errors).toEqual(["The file is not valid JSON."]);
    expect(broken["a.json"].theme?.tokens.colors.accent.default).toBe("#00ff00");

    const invalid = loadThemeFolder(
      [file("a.json", extending("a", "nord", "pink"))],
      builtInThemeList,
      reserved,
      broken,
    );
    expect(invalid["a.json"].errors[0]).toMatch(/invalid color value "pink"/);
    expect(invalid["a.json"].theme?.tokens.colors.accent.default).toBe("#00ff00");
  });

  it("drops files that were removed", () => {
    const first = loadThemeFolder(
      [file("a.json", extending("a", "nord"))],
      builtInThemeList,
      reserved,
      {},
    );
    expect(loadThemeFolder([], builtInThemeList, reserved, first)).toEqual({});
  });

  it("shows the first three errors and counts the rest", () => {
    expect(themeErrorLines(["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "and 2 more"]);
    expect(themeErrorLines(["a"])).toEqual(["a"]);
  });
});
