import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { generateCssVariables } from "./applyTheme";
import { contrastRatio, parseColor, type Rgba } from "./color";
import { builtInThemeList } from "./themes";

const SRC = join(process.cwd(), "src");
const THEMES = ["dark-default", "light-default"];
const SURFACES = ["--bg-root", "--bg-chrome", "--bg-surface", "--bg-elevated"];

/** Tailwind text colors and the theme variable behind them. */
const TOKENS: Record<string, string> = {
  "fg-default": "--fg-default",
  "fg-muted": "--fg-muted",
  "fg-subtle": "--fg-subtle",
  primary: "--primary",
  "status-success": "--color-status-success",
  "status-error": "--color-status-error",
  "status-warning": "--color-status-warning",
  "status-info": "--color-status-info",
};

function variables(id: string): Map<string, string> {
  const theme = builtInThemeList.find((entry) => entry.metadata.id === id);
  if (!theme) throw new Error(`missing theme ${id}`);
  return new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
}

function color(css: Map<string, string>, name: string): Rgba {
  const parsed = parseColor(css.get(name) ?? "");
  if (!parsed) throw new Error(`${name} is not a color`);
  return parsed;
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (a: number, b: number) => Math.round(a * top.a + b * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** Every `text-<token>/<alpha>` class in the components, as token and alpha. */
function dimmedTextClasses(): { token: string; alpha: number; file: string }[] {
  const found: { token: string; alpha: number; file: string }[] = [];
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (file) => file.endsWith(".tsx") && !file.includes(".test."),
  );
  for (const file of files) {
    const source = readFileSync(join(SRC, file), "utf8");
    for (const match of source.matchAll(/\btext-([a-z-]+)\/(\d+)\b/g)) {
      if (TOKENS[match[1]]) found.push({ token: match[1], alpha: Number(match[2]) / 100, file });
    }
  }
  return found;
}

describe("dimmed text", () => {
  const classes = dimmedTextClasses();

  for (const id of THEMES) {
    it(`keeps text with opacity at 4.5:1 in ${id}`, () => {
      const css = variables(id);
      const failures: string[] = [];
      for (const { token, alpha, file } of classes) {
        const text = color(css, TOKENS[token]);
        for (const surface of SURFACES) {
          const ratio = contrastRatio({ ...text, a: text.a * alpha }, color(css, surface));
          if (ratio < 4.5) {
            failures.push(
              `text-${token}/${alpha * 100} on ${surface} in ${file}: ${ratio.toFixed(2)}`,
            );
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it(`keeps diff lines readable on their tinted rows in ${id}`, () => {
      const css = variables(id);
      for (const status of ["success", "error", "info"]) {
        const tone = color(css, `--color-status-${status}`);
        for (const tint of [0.05, 0.1, 0.15]) {
          const row = over({ ...tone, a: tint }, color(css, "--bg-root"));
          expect(contrastRatio(tone, row), `${status} on ${tint}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
