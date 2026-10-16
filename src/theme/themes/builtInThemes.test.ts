import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables } from "../applyTheme";
import { contrastRatio, parseColor } from "../color";
import { builtInThemeList, shortThemeFiles } from "./index";

const SYNTAX = [
  "keyword",
  "string",
  "function",
  "variable",
  "number",
  "type",
  "attribute",
  "property",
  "operator",
];
const shortIds = shortThemeFiles.map((file) => (file as { metadata: { id: string } }).metadata.id);
const shortThemes = builtInThemeList.filter((theme) => shortIds.includes(theme.metadata.id));

function ratio(fg: string | undefined, bg: string | undefined): number {
  const f = parseColor(fg ?? "");
  const b = parseColor(bg ?? "");
  if (!f || !b) throw new Error(`not a color: ${fg} on ${bg}`);
  return contrastRatio(f, b);
}

describe("built-in themes", () => {
  it("resolves every theme written in the short format", () => {
    expect(shortIds.length).toBeGreaterThanOrEqual(12);
    expect(shortThemes.map((theme) => theme.metadata.id)).toEqual(shortIds);
  });

  it("uses unique ids", () => {
    const ids = builtInThemeList.map((theme) => theme.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("credits the original author, license and source of every new theme", () => {
    for (const { metadata } of shortThemes) {
      expect(metadata.author, metadata.id).toBeTruthy();
      expect(metadata.license, metadata.id).toBe("MIT");
      // Pragma's own themes have no upstream source.
      if (metadata.author !== "Pragma Team") {
        expect(metadata.homepage, metadata.id).toMatch(/^https:\/\//);
      }
    }
  });

  for (const theme of shortThemes) {
    it(`keeps ${theme.metadata.id} readable`, () => {
      const css = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
      const bg = css.get("--bg-root");
      expect(ratio(css.get("--fg-default"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--editor-fg"), css.get("--editor-bg"))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--terminal-fg"), css.get("--terminal-bg"))).toBeGreaterThanOrEqual(4.5);
      for (const token of SYNTAX) {
        expect(ratio(css.get(`--syntax-${token}`), bg), token).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
