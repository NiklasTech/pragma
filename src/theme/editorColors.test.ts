import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables } from "./applyTheme";
import {
  EDITOR_COLOR_SCOPE,
  editorColorsCss,
  editorColorVariables,
  terminalColorVariables,
} from "./editorColors";
import { getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

const nord = getBuiltInTheme("nord") as Theme;
const solarizedLight = getBuiltInTheme("solarized-light") as Theme;

function asMap(vars: { name: string; value: string }[]): Map<string, string> {
  return new Map(vars.map(({ name, value }) => [name, value]));
}

describe("editor colors", () => {
  it("adds nothing while the editor follows the UI theme without overrides", () => {
    expect(editorColorVariables(undefined, {})).toEqual([]);
    expect(editorColorsCss([], [])).toBe("");
  });

  it("takes another theme's editor and syntax colors with references resolved", () => {
    const vars = asMap(editorColorVariables(solarizedLight, {}));
    const theme = asMap(generateCssVariables(solarizedLight));
    expect(vars.get("--editor-bg")).toBe("#fdf6e3");
    expect(vars.get("--editor-gutter-bg")).toBe("#fdf6e3");
    expect(vars.get("--syntax-keyword")).toBe(theme.get("--syntax-keyword"));
    expect(vars.get("--editor-cursor")).toBe(theme.get("--color-accent"));
  });

  it("touches only editor and syntax variables, never the UI colors", () => {
    for (const { name } of editorColorVariables(solarizedLight, { keyword: "#ff0000" })) {
      expect(name).toMatch(/^--(editor|syntax|color-editor|color-syntax)-/);
    }
  });

  it("applies overrides on top of the UI theme and of another editor theme", () => {
    const own = asMap(editorColorVariables(undefined, { keyword: "#ff0000" }));
    expect(own.get("--syntax-keyword")).toBe("#ff0000");
    expect(own.get("--color-syntax-keyword")).toBe("#ff0000");
    expect(own.has("--editor-bg")).toBe(false);

    const onTheme = asMap(editorColorVariables(nord, { background: "#101010" }));
    expect(onTheme.get("--editor-bg")).toBe("#101010");
    expect(onTheme.get("--editor-gutter-bg")).toBe("#101010");
    expect(onTheme.get("--syntax-keyword")).toBe(
      asMap(generateCssVariables(nord)).get("--syntax-keyword"),
    );
  });

  it("keeps overrides when the editor theme changes", () => {
    const overrides = { string: "#00ff00" };
    expect(asMap(editorColorVariables(nord, overrides)).get("--syntax-string")).toBe("#00ff00");
    expect(asMap(editorColorVariables(solarizedLight, overrides)).get("--syntax-string")).toBe(
      "#00ff00",
    );
  });

  it("ignores invalid override values", () => {
    expect(editorColorVariables(undefined, { keyword: "nope", string: "" })).toEqual([]);
  });

  it("scopes editor colors to editor surfaces", () => {
    const css = editorColorsCss(editorColorVariables(undefined, { keyword: "#ff0000" }), []);
    expect(css.startsWith(`${EDITOR_COLOR_SCOPE} {`)).toBe(true);
    expect(css).toContain("--syntax-keyword: #ff0000;");
    expect(css).not.toContain(":root");
  });
});

describe("terminal colors", () => {
  it("follows the UI theme unless another theme is chosen", () => {
    expect(terminalColorVariables(undefined)).toEqual([]);
    const vars = asMap(terminalColorVariables(solarizedLight));
    expect(vars.get("--terminal-bg")).toBe("#fdf6e3");
    for (const name of vars.keys()) expect(name).toMatch(/^--(terminal|color-terminal)-/);
  });

  it("overrides the theme's root values for terminals", () => {
    const css = editorColorsCss([], terminalColorVariables(solarizedLight));
    expect(css).toContain(":root {");
    expect(css).toContain("--terminal-bg: #fdf6e3 !important;");
  });
});
