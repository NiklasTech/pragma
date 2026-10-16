import { describe, expect, it } from "vite-plus/test";
import { defaultSettings } from "@/shared/stores/settings/defaults";
import { generateCssVariables } from "./applyTheme";
import {
  BACKGROUND_DEFAULTS,
  backgroundStyle,
  clampBlur,
  clampDim,
  clampTransparency,
  surfaceAlpha,
  type BackgroundSettings,
} from "./background";
import { contrastRatio, mix, parseColor, type Rgba } from "./color";
import { getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

const dark = getBuiltInTheme("dark-default") as Theme;
const vars = new Map(generateCssVariables(dark).map(({ name, value }) => [name, value]));
const color = (name: string) => parseColor(vars.get(name) ?? "") as Rgba;
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

function settings(change: Partial<BackgroundSettings>): BackgroundSettings {
  return { ...BACKGROUND_DEFAULTS, ...change };
}

const image = { image: true, window: false };
const windowOnly = { image: false, window: true };
const nothing = { image: false, window: false };

describe("background defaults", () => {
  it("start without image and transparency", () => {
    expect(defaultSettings.background).toEqual(BACKGROUND_DEFAULTS);
    expect(BACKGROUND_DEFAULTS.image).toBe("");
    expect(BACKGROUND_DEFAULTS.transparency).toBe(0);
    expect(BACKGROUND_DEFAULTS.transparentEditor).toBe(false);
    expect(BACKGROUND_DEFAULTS.transparentTerminal).toBe(false);
  });

  it("change nothing at transparency 0, so Pragma looks like today", () => {
    expect(backgroundStyle(dark, BACKGROUND_DEFAULTS, image)).toEqual({
      css: "",
      terminalAlpha: 1,
    });
    expect(backgroundStyle(dark, settings({ transparentEditor: true }), windowOnly).css).toBe("");
  });

  it("change nothing when nothing lies behind the surfaces", () => {
    expect(backgroundStyle(dark, settings({ transparency: 60 }), nothing).css).toBe("");
  });
});

describe("surface opacity", () => {
  it("shows a dimmed image behind sidebar and panels with readable text", () => {
    const style = backgroundStyle(dark, settings({ transparency: 50, dim: 60 }), image);
    expect(style.css).toMatch(/--bg-root: rgba\(13, 16, 22, 0\.\d+\) !important;/);
    expect(style.css).toMatch(/--bg-surface: rgba\(/);
    expect(style.css).toMatch(/--sidebar: rgba\(/);

    const root = color("--bg-root");
    const alpha = surfaceAlpha(
      root,
      color("--fg-default"),
      color("--fg-muted"),
      50,
      image,
      60,
      root,
    );
    expect(alpha).toBeLessThan(1);
    for (const under of [mix(BLACK, root, 0.6), mix(WHITE, root, 0.6)]) {
      const shown = mix(under, root, alpha);
      expect(contrastRatio(color("--fg-default"), shown)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is as transparent as requested when text stays readable", () => {
    const root = color("--bg-root");
    expect(
      surfaceAlpha(root, color("--fg-default"), color("--fg-muted"), 30, image, 90, root),
    ).toBe(0.7);
  });

  it("limits transparency where text would get hard to read", () => {
    const root = color("--bg-root");
    const alpha = surfaceAlpha(
      root,
      color("--fg-default"),
      color("--fg-muted"),
      80,
      image,
      0,
      root,
    );
    expect(alpha).toBeGreaterThan(0.2);
    for (const under of [BLACK, WHITE]) {
      expect(contrastRatio(color("--fg-default"), mix(under, root, alpha))).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(color("--fg-muted"), mix(under, root, alpha))).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps menus and dialogs opaque", () => {
    const css = backgroundStyle(dark, settings({ transparency: 50 }), image).css;
    expect(css).not.toContain("--bg-elevated");
    expect(css).not.toContain("--popover");
  });

  it("clears the page background only for window translucency", () => {
    expect(backgroundStyle(dark, settings({ transparency: 40 }), windowOnly).css).toContain(
      "html, body",
    );
    expect(backgroundStyle(dark, settings({ transparency: 40 }), image).css).not.toContain(
      "html, body",
    );
  });

  it("leaves editor and terminal opaque unless turned on", () => {
    const off = backgroundStyle(dark, settings({ transparency: 50 }), image);
    expect(off.css).not.toContain(".cm-editor");
    expect(off.terminalAlpha).toBe(1);

    const on = backgroundStyle(
      dark,
      settings({ transparency: 50, transparentEditor: true, transparentTerminal: true }),
      image,
    );
    expect(on.css).toMatch(
      /\.cm-editor \{\n  background-color: color-mix\(in srgb, var\(--editor-bg\) \d+%, transparent\)/,
    );
    expect(on.css).toContain(".bg-terminal-bg, .xterm-viewport");
    expect(on.terminalAlpha).toBeLessThan(1);
  });
});

describe("background settings", () => {
  it("clamps blur, dim and transparency", () => {
    expect(clampBlur(-3)).toBe(0);
    expect(clampBlur(99)).toBe(40);
    expect(clampDim(120)).toBe(90);
    expect(clampDim(Number.NaN)).toBe(60);
    expect(clampTransparency(95)).toBe(80);
    expect(clampTransparency(-1)).toBe(0);
    expect(clampTransparency(33.4)).toBe(33);
  });
});
