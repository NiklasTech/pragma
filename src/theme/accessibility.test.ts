import { describe, expect, it } from "vite-plus/test";
import { defaultSettings } from "@/shared/stores/settings/defaults";
import { effectiveReduceMotion, themeContrastIssues, withColorBlindStatus } from "./accessibility";
import { generateCssVariables } from "./applyTheme";
import { contrastRatio, parseColor, type Rgba } from "./color";
import { builtInThemeList, getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

function css(theme: Theme): Map<string, string> {
  return new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
}

function color(value: string | undefined): Rgba {
  const parsed = parseColor(value ?? "");
  if (!parsed) throw new Error(`not a color: ${value}`);
  return parsed;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

// Viénot, Brettel and Mollon (1999) simulation of protanopia and deuteranopia in linear RGB.
const SIMULATIONS: Record<string, number[][]> = {
  protanopia: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1],
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1],
  ],
};

function toLab([r, g, b]: number[]): number[] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function simulatedLab(c: Rgba, kind: string): number[] {
  const rgb = [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
  const m = SIMULATIONS[kind];
  const out = m.map((row) =>
    Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
  );
  return toLab(out);
}

function deltaE(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const GIT_VARS = [
  "--color-git-added",
  "--color-git-modified",
  "--color-git-deleted",
  "--color-git-untracked",
  "--color-git-conflict",
];

describe("color blind friendly status colors", () => {
  it("is off by default", () => {
    expect(defaultSettings.appearance.colorBlindStatus).toBe(false);
  });

  it("keeps added, modified, deleted, untracked and conflicted apart with red-green deficiency", () => {
    for (const theme of builtInThemeList) {
      const vars = css(withColorBlindStatus(theme));
      for (const kind of Object.keys(SIMULATIONS)) {
        const labs = GIT_VARS.map((name) => simulatedLab(color(vars.get(name)), kind));
        for (let i = 0; i < labs.length; i++) {
          for (let j = i + 1; j < labs.length; j++) {
            expect(
              deltaE(labs[i], labs[j]),
              `${theme.metadata.id} ${kind} ${GIT_VARS[i]} vs ${GIT_VARS[j]}`,
            ).toBeGreaterThanOrEqual(10);
          }
        }
      }
    }
  });

  it("keeps status text readable on the theme background", () => {
    for (const theme of builtInThemeList) {
      const vars = css(withColorBlindStatus(theme));
      for (const name of [...GIT_VARS, "--color-status-success", "--color-status-error"]) {
        expect(
          contrastRatio(color(vars.get(name)), color(vars.get("--bg-root"))),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("leaves the built-in theme untouched", () => {
    const nord = getBuiltInTheme("nord") as Theme;
    const before = nord.tokens.colors.git.conflict;
    withColorBlindStatus(nord);
    expect(nord.tokens.colors.git.conflict).toBe(before);
  });
});

describe("reduce motion", () => {
  it("follows the system unless forced", () => {
    expect(defaultSettings.appearance.reduceMotion).toBe("system");
    expect(effectiveReduceMotion("system", true)).toBe(true);
    expect(effectiveReduceMotion("system", false)).toBe(false);
    expect(effectiveReduceMotion("on", false)).toBe(true);
    expect(effectiveReduceMotion("off", true)).toBe(false);
  });
});

describe("theme contrast check", () => {
  it("passes every built-in theme", () => {
    for (const theme of builtInThemeList) {
      expect(themeContrastIssues(theme), theme.metadata.id).toEqual([]);
    }
  });

  it("reports text below 4.5:1", () => {
    const dark = structuredClone(getBuiltInTheme("dark-default") as Theme);
    dark.tokens.colors.foreground.default = "#3a3f4a";
    const issues = themeContrastIssues(dark);
    expect(issues[0]).toMatch(/^Text contrast is \d\.\d:1, below 4\.5:1$/);
    expect(issues.some((issue) => issue.startsWith("Editor text"))).toBe(true);
  });
});

describe("high contrast themes", () => {
  for (const id of ["high-contrast-dark", "high-contrast-light"]) {
    it(`gives ${id} 7:1 text and 3:1 outlines`, () => {
      const theme = getBuiltInTheme(id) as Theme;
      const vars = css(theme);
      const root = color(vars.get("--bg-root"));
      expect(contrastRatio(color(vars.get("--fg-default")), root)).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(color(vars.get("--editor-fg")), color(vars.get("--editor-bg"))),
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(color(vars.get("--terminal-fg")), color(vars.get("--terminal-bg"))),
      ).toBeGreaterThanOrEqual(7);
      for (const name of [
        "--border-default",
        "--border-subtle",
        "--border-focus",
        "--color-accent",
      ]) {
        expect(contrastRatio(color(vars.get(name)), root), name).toBeGreaterThanOrEqual(3);
      }
      expect(
        contrastRatio(color(vars.get("--primary-foreground")), color(vars.get("--primary"))),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
