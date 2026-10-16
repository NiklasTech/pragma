export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

const HEX_REGEX = /^#([a-fA-F0-9]{3,4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/;
const RGB_REGEX = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

export function parseColor(value: string): Rgba | null {
  const trimmed = value.trim();
  if (trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = HEX_REGEX.exec(trimmed);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = digits.replace(/./g, (d) => d + d);
    const channel = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return {
      r: channel(0),
      g: channel(1),
      b: channel(2),
      a: digits.length === 8 ? channel(3) / 255 : 1,
    };
  }

  const rgb = RGB_REGEX.exec(trimmed);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((c) => Math.min(255, Number(c)));
    const a = rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4]));
    return { r, g, b, a };
  }

  return null;
}

function hexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function formatColor(color: Rgba): string {
  if (color.a >= 1) return `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
  const alpha = Math.round(color.a * 1000) / 1000;
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

/** Linear blend in sRGB; t = 0 gives `from`, t = 1 gives `to`. */
export function mix(from: Rgba, to: Rgba, t: number): Rgba {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    r: lerp(from.r, to.r),
    g: lerp(from.g, to.g),
    b: lerp(from.b, to.b),
    a: lerp(from.a, to.a),
  };
}

export function withAlpha(color: Rgba, a: number): Rgba {
  return { ...color, a };
}

/** Flattens a translucent color onto an opaque background. */
function composite(color: Rgba, background: Rgba): Rgba {
  return { ...mix(background, color, color.a), a: 1 };
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque color. */
export function luminance(color: Rgba): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** WCAG contrast ratio of a (possibly translucent) foreground on an opaque background. */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const fg = luminance(composite(foreground, background));
  const bg = luminance(background);
  const [light, dark] = fg > bg ? [fg, bg] : [bg, fg];
  return (light + 0.05) / (dark + 0.05);
}

export function isDarkColor(color: Rgba): boolean {
  return contrastRatio(WHITE, color) >= contrastRatio(BLACK, color);
}

/**
 * Moves `color` toward white or black until it reaches `minRatio` against every background.
 * Colors that already pass are returned unchanged.
 */
export function ensureContrast(color: Rgba, backgrounds: Rgba[], minRatio: number): Rgba {
  const passes = (c: Rgba) => backgrounds.every((bg) => contrastRatio(c, bg) >= minRatio);
  const opaque = { ...color, a: 1 };
  if (passes(opaque)) return opaque;

  const target = isDarkColor(backgrounds[0]) ? WHITE : BLACK;
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(opaque, target, step / 20);
    if (passes(candidate)) return candidate;
  }
  return target;
}
