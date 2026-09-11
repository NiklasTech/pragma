import { describe, expect, it } from "vite-plus/test";

import { generateCssVariables } from "./applyTheme";
import { builtInThemeList } from "./themes";
import darkDefault from "./themes/dark-default.json";
import lightDefault from "./themes/light-default.json";
import type { Theme, ThemeInput } from "./types";
import { validateTheme } from "./validateTheme";

function shadowErrors(theme: ThemeInput): string[] {
  return validateTheme(theme).errors.filter((error) => error.startsWith("tokens.shadows"));
}

function darkTheme(): ThemeInput {
  return structuredClone(darkDefault) as unknown as ThemeInput;
}

function setShadows(theme: ThemeInput, shadows: unknown): void {
  (theme.tokens as { shadows?: unknown }).shadows = shadows;
}

describe("theme shadow tokens", () => {
  it("accepts optional shadows on the built-in themes", () => {
    expect(shadowErrors(darkTheme())).toEqual([]);
    expect(shadowErrors(structuredClone(lightDefault) as unknown as ThemeInput)).toEqual([]);
  });

  it("does not require shadows on themes that omit them", () => {
    const theme = darkTheme();
    delete theme.tokens.shadows;
    expect(shadowErrors(theme)).toEqual([]);
  });

  it("rejects an incomplete shadows group", () => {
    const theme = darkTheme();
    setShadows(theme, { sm: "0 4px 16px rgba(0, 0, 0, 0.28)" });
    expect(shadowErrors(theme)).toContain('tokens.shadows: missing required key "md"');
  });

  it("rejects non-string shadow values", () => {
    const theme = darkTheme();
    setShadows(theme, { sm: 4, md: "" });
    expect(shadowErrors(theme)).toContain("tokens.shadows.sm: must be a string");
  });

  it("gives every built-in theme complete shadow tokens", () => {
    for (const theme of builtInThemeList) {
      expect(shadowErrors(theme)).toEqual([]);
      expect(typeof theme.tokens.shadows?.sm).toBe("string");
      expect(typeof theme.tokens.shadows?.md).toBe("string");
    }
  });

  it("maps dark shadows onto --shadow-sm and --shadow-md", () => {
    const vars = new Map(
      generateCssVariables(darkTheme() as Theme).map(({ name, value }) => [name, value]),
    );
    expect(vars.get("--shadow-sm")).toBe("0 4px 16px rgba(0, 0, 0, 0.28)");
    expect(vars.get("--shadow-md")).toBe("0 12px 40px rgba(0, 0, 0, 0.45)");
  });

  it("maps softer light shadows", () => {
    const vars = new Map(
      generateCssVariables(structuredClone(lightDefault) as unknown as Theme).map(
        ({ name, value }) => [name, value],
      ),
    );
    expect(vars.get("--shadow-sm")).toBe("0 4px 16px rgba(15, 23, 42, 0.10)");
    expect(vars.get("--shadow-md")).toBe("0 12px 40px rgba(15, 23, 42, 0.18)");
  });
});
