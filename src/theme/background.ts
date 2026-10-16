import { generateCssVariables } from "./applyTheme";
import { contrastRatio, formatColor, mix, parseColor, withAlpha, type Rgba } from "./color";
import type { Theme } from "./types";

export type BackgroundFit = "cover" | "contain" | "tile" | "center";
export type BackgroundPosition = "center" | "top" | "bottom" | "left" | "right";

export const BACKGROUND_FITS: BackgroundFit[] = ["cover", "contain", "tile", "center"];
export const BACKGROUND_POSITIONS: BackgroundPosition[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
];

export interface BackgroundSettings {
  /** File name in the app data background folder; empty for no image. */
  image: string;
  fit: BackgroundFit;
  position: BackgroundPosition;
  /** Blur of the image in pixels. */
  blur: number;
  /** How much of the theme's root color covers the image, in percent. */
  dim: number;
  /** How much of the background shows through the surfaces, in percent. */
  transparency: number;
  transparentEditor: boolean;
  transparentTerminal: boolean;
}

export const BACKGROUND_DEFAULTS: BackgroundSettings = {
  image: "",
  fit: "cover",
  position: "center",
  blur: 0,
  dim: 60,
  transparency: 0,
  transparentEditor: false,
  transparentTerminal: false,
};

export const MAX_BLUR = 40;
export const MAX_DIM = 90;
export const MAX_TRANSPARENCY = 80;
const TEXT_CONTRAST = 4.5;
const MUTED_CONTRAST = 3;
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const clampBlur = (value: number) => clamp(value, 0, MAX_BLUR, 0);
export const clampDim = (value: number) => clamp(value, 0, MAX_DIM, BACKGROUND_DEFAULTS.dim);
export const clampTransparency = (value: number) => clamp(value, 0, MAX_TRANSPARENCY, 0);

export function isBackgroundFit(value: unknown): value is BackgroundFit {
  return typeof value === "string" && (BACKGROUND_FITS as string[]).includes(value);
}

export function isBackgroundPosition(value: unknown): value is BackgroundPosition {
  return typeof value === "string" && (BACKGROUND_POSITIONS as string[]).includes(value);
}

/** What lies behind the surfaces: a dimmed image, the desktop through the window, or nothing. */
export interface Backdrop {
  image: boolean;
  window: boolean;
}

/** The darkest and lightest colors the backdrop can show under a surface. */
function backdropExtremes(backdrop: Backdrop, dim: number, dimColor: Rgba): Rgba[] {
  if (!backdrop.image) return [BLACK, WHITE];
  const cover = clampDim(dim) / 100;
  return [mix(BLACK, dimColor, cover), mix(WHITE, dimColor, cover)];
}

/**
 * Opacity for a surface: as transparent as requested, but opaque enough that text keeps
 * 4.5:1 (muted text 3:1) over the darkest and the lightest backdrop.
 */
export function surfaceAlpha(
  surface: Rgba,
  text: Rgba,
  muted: Rgba,
  transparency: number,
  backdrop: Backdrop,
  dim: number,
  dimColor: Rgba,
): number {
  const requested = 1 - clampTransparency(transparency) / 100;
  if (requested >= 1 || (!backdrop.image && !backdrop.window)) return 1;
  const extremes = backdropExtremes(backdrop, dim, dimColor);
  const readable = (alpha: number) =>
    extremes.every((under) => {
      const shown = mix(under, { ...surface, a: 1 }, alpha);
      return (
        contrastRatio(text, shown) >= TEXT_CONTRAST && contrastRatio(muted, shown) >= MUTED_CONTRAST
      );
    });
  for (let step = Math.round(requested * 100); step < 100; step++) {
    if (readable(step / 100)) return step / 100;
  }
  return 1;
}

const SURFACES: [string, string[]][] = [
  ["--bg-root", ["--bg-root", "--color-bg-root", "--background", "--sidebar"]],
  ["--bg-surface", ["--bg-surface", "--color-bg-surface", "--card"]],
  ["--bg-chrome", ["--bg-chrome", "--color-bg-chrome"]],
];

export interface BackgroundStyle {
  css: string;
  /** Opacity of the terminal background, read by the xterm theme. */
  terminalAlpha: number;
}

/** CSS that lets the backdrop show through; empty with no transparency or nothing behind. */
export function backgroundStyle(
  theme: Theme,
  settings: BackgroundSettings,
  backdrop: Backdrop,
): BackgroundStyle {
  const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
  const color = (name: string) => parseColor(vars.get(name) ?? "") ?? BLACK;
  const text = color("--fg-default");
  const muted = color("--fg-muted");
  const root = color("--bg-root");
  const alphaFor = (surface: Rgba, fg = text) =>
    surfaceAlpha(surface, fg, muted, settings.transparency, backdrop, settings.dim, root);

  const rules: string[] = [];
  const declarations: string[] = [];
  for (const [source, names] of SURFACES) {
    const surface = color(source);
    const alpha = alphaFor(surface);
    if (alpha >= 1) continue;
    const value = formatColor(withAlpha(surface, alpha));
    for (const name of names) declarations.push(`  ${name}: ${value} !important;`);
  }
  if (declarations.length > 0) rules.push(`:root {\n${declarations.join("\n")}\n}`);
  if (declarations.length > 0 && backdrop.window) {
    rules.push("html, body {\n  background-color: transparent !important;\n}");
  }

  if (settings.transparentEditor) {
    const alpha = alphaFor(color("--editor-bg"), color("--editor-fg"));
    if (alpha < 1) {
      const percent = Math.round(alpha * 100);
      rules.push(
        `.cm-editor {\n  background-color: color-mix(in srgb, var(--editor-bg) ${percent}%, transparent) !important;\n}`,
        `.cm-gutters {\n  background-color: color-mix(in srgb, var(--editor-gutter-bg) ${percent}%, transparent) !important;\n}`,
      );
    }
  }

  let terminalAlpha = 1;
  if (settings.transparentTerminal) {
    terminalAlpha = alphaFor(color("--terminal-bg"), color("--terminal-fg"));
    if (terminalAlpha < 1) {
      const percent = Math.round(terminalAlpha * 100);
      rules.push(
        `.bg-terminal-bg, .xterm-viewport {\n  background-color: color-mix(in srgb, var(--terminal-bg) ${percent}%, transparent) !important;\n}`,
      );
    }
  }

  return { css: rules.join("\n"), terminalAlpha };
}

const STYLE_ID = "pragma-background";

export function applyBackgroundStyle(style: BackgroundStyle): void {
  if (typeof document === "undefined") return;
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement("style");
    element.id = STYLE_ID;
    document.head.appendChild(element);
  }
  element.textContent = style.css;
  document.documentElement.style.setProperty(
    "--terminal-surface-alpha",
    String(style.terminalAlpha),
  );
}
