import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables } from "../applyTheme";
import { contrastRatio, parseColor } from "../color";
import { builtInThemeList } from "./index";

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

function ratio(fg: string | undefined, bg: string | undefined): number {
  const f = parseColor(fg ?? "");
  const b = parseColor(bg ?? "");
  if (!f || !b) throw new Error(`not a color: ${fg} on ${bg}`);
  return contrastRatio(f, b);
}

describe("built-in themes", () => {
  it("ships Pragma Dark and Light plus the two high contrast themes", () => {
    expect(builtInThemeList.map((theme) => theme.metadata.id)).toEqual([
      "dark-default",
      "light-default",
      "high-contrast-dark",
      "high-contrast-light",
    ]);
  });

  it("uses unique ids", () => {
    const ids = builtInThemeList.map((theme) => theme.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const id of ["dark-default", "light-default"]) {
    it(`keeps every text level of ${id} readable on ground, wells and sheets`, () => {
      const theme = builtInThemeList.find((entry) => entry.metadata.id === id);
      if (!theme) throw new Error(`missing theme ${id}`);
      const css = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
      const surfaces = ["--bg-chrome", "--bg-root", "--bg-surface", "--bg-elevated", "--bg-input"];
      const texts = [
        "--fg-default",
        "--fg-muted",
        "--fg-subtle",
        "--color-accent",
        "--color-status-success",
        "--color-status-warning",
        "--color-status-error",
        "--color-status-info",
      ];
      for (const surface of surfaces) {
        for (const text of texts) {
          expect(
            ratio(css.get(text), css.get(surface)),
            `${text} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(ratio(css.get("--fg-inverse"), css.get("--color-accent"))).toBeGreaterThanOrEqual(4.5);
      for (const token of SYNTAX) {
        expect(
          ratio(css.get(`--syntax-${token}`), css.get("--editor-bg")),
          token,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
