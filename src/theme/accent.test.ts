import { describe, expect, it } from "vite-plus/test";
import { readableAccent, withAccent } from "./accent";
import { generateCssVariables, themeMode } from "./applyTheme";
import { contrastRatio, parseColor } from "./color";
import { accentTints } from "./palette";
import { builtInThemeList, getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

// Sample accents across the hue circle for the contrast checks.
const ACCENT_PRESETS = [
  "#2f9bff",
  "#6e7bf2",
  "#a78bfa",
  "#f472b6",
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
];

const dark = getBuiltInTheme("dark-default") as Theme;
const light = getBuiltInTheme("light-default") as Theme;

function css(theme: Theme): Map<string, string> {
  return new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
}

function ratio(a: string | undefined, b: string | undefined): number {
  return contrastRatio(
    parseColor(a ?? "") ?? { r: 0, g: 0, b: 0, a: 1 },
    parseColor(b ?? "") ?? { r: 0, g: 0, b: 0, a: 1 },
  );
}

describe("accent color", () => {
  it("changes buttons, focus rings, selection and active states in every built-in theme", () => {
    for (const theme of builtInThemeList) {
      const accented = withAccent(theme, "#ff00aa");
      const vars = css(accented);
      const accent = vars.get("--color-accent");
      expect(accent, theme.metadata.id).toBe(readableAccent(theme, "#ff00aa")?.color);
      expect(vars.get("--primary")).toBe(accent);
      expect(vars.get("--ring")).toBe(accent);
      expect(vars.get("--color-thread-active")).toBe(accent);
      const tints = accentTints(
        parseColor(accent ?? "") ?? { r: 0, g: 0, b: 0, a: 1 },
        themeMode(theme),
      );
      expect(vars.get("--border-focus")).toBe(tints.focus);
      expect(vars.get("--editor-selection")).toBe(tints.selection);
      expect(vars.get("--bg-active")).toBe(tints.active);
      expect(vars.get("--color-accent-subtle")).toBe(tints.subtle);
    }
  });

  it("keeps text on accent buttons readable in every theme", () => {
    for (const theme of builtInThemeList) {
      for (const color of [...ACCENT_PRESETS, "#000000", "#ffffff", "#777777"]) {
        const vars = css(withAccent(theme, color));
        expect(
          ratio(vars.get("--primary-foreground"), vars.get("--primary")),
          `${theme.metadata.id} ${color}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(ratio(vars.get("--primary"), vars.get("--bg-root"))).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("reports when the color had to be adjusted", () => {
    expect(readableAccent(dark, "#88c0d0")).toEqual({ color: "#88c0d0", adjusted: false });
    const tooDark = readableAccent(dark, "#1a1a2e");
    expect(tooDark?.adjusted).toBe(true);
    const tooLight = readableAccent(light, "#fff3a0");
    expect(tooLight?.adjusted).toBe(true);
  });

  it("ignores values that are not colors", () => {
    expect(readableAccent(dark, "pink")).toBeNull();
    expect(withAccent(dark, "pink")).toBe(dark);
  });

  it("leaves the built-in theme untouched", () => {
    const before = dark.tokens.colors.accent.default;
    withAccent(dark, "#ff00aa");
    expect(dark.tokens.colors.accent.default).toBe(before);
  });
});
