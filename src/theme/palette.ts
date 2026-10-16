import {
  ensureContrast,
  formatColor,
  isDarkColor,
  mix,
  parseColor,
  withAlpha,
  type Rgba,
} from "./color";
import type { SupportedMode, ThemePalette, ThemeTokens } from "./types";

const TEXT_CONTRAST = 4.5;
const DIM_TEXT_CONTRAST = 3;

// Hues of the default dark and light themes; derived themes lift them to readable contrast.
const STATUS = {
  dark: {
    success: "#3fb68b",
    warning: "#e0a94e",
    error: "#e35d6a",
    info: "#5b9cf5",
    conflict: "#a78bfa",
  },
  light: {
    success: "#1f9d6e",
    warning: "#c28a1f",
    error: "#d6455a",
    info: "#3b7fe0",
    conflict: "#7c5cd6",
  },
};

const SYNTAX = {
  dark: {
    keyword: "#c792ea",
    string: "#c3e88d",
    function: "#82aaff",
    variable: "#b6d6ff",
    number: "#f78c6c",
    type: "#ffcb6b",
    attribute: "#c3e88d",
    property: "#f07178",
    operator: "#89ddff",
  },
  light: {
    keyword: "#7c5cd6",
    string: "#1f8a55",
    function: "#3b6fd4",
    variable: "#1e40af",
    number: "#c2600c",
    type: "#2b6cb0",
    attribute: "#0a6ee6",
    property: "#0f766e",
    operator: "#6d28d9",
  },
};

const ANSI = {
  dark: {
    ansi: {
      red: "#e35d6a",
      green: "#3fb68b",
      yellow: "#e0a94e",
      blue: "#2f9bff",
      magenta: "#a78bfa",
      cyan: "#4ec9d8",
    },
    bright: {
      red: "#ed7f8b",
      green: "#5fcfa5",
      yellow: "#edbf72",
      blue: "#6cb8ff",
      magenta: "#bba5f9",
      cyan: "#7adbe7",
    },
  },
  light: {
    ansi: {
      red: "#d6455a",
      green: "#1f9d6e",
      yellow: "#c28a1f",
      blue: "#0a6ee6",
      magenta: "#7c5cd6",
      cyan: "#0e8fa3",
    },
    bright: {
      red: "#e35d6a",
      green: "#3fb68b",
      yellow: "#e0a94e",
      blue: "#6e7bf2",
      magenta: "#a78bfa",
      cyan: "#22b8cf",
    },
  },
};

const SHADOWS = {
  dark: { sm: "0 4px 16px rgba(0, 0, 0, 0.28)", md: "0 12px 40px rgba(0, 0, 0, 0.45)" },
  light: { sm: "0 4px 16px rgba(15, 23, 42, 0.10)", md: "0 12px 40px rgba(15, 23, 42, 0.18)" },
};

export interface AccentTints {
  subtle: string;
  glow: string;
  focus: string;
  selection: string;
  active: string;
  lineHighlight: string;
}

/** The translucent accent shades for hover, focus and selection states. */
export function accentTints(accent: Rgba, mode: SupportedMode): AccentTints {
  const dark = mode === "dark";
  const alpha = (a: number) => formatColor(withAlpha({ ...accent, a: 1 }, a));
  return {
    subtle: alpha(dark ? 0.14 : 0.1),
    glow: alpha(dark ? 0.3 : 0.25),
    focus: alpha(dark ? 0.5 : 0.45),
    selection: alpha(dark ? 0.22 : 0.16),
    active: alpha(dark ? 0.14 : 0.1),
    lineHighlight: alpha(dark ? 0.06 : 0.05),
  };
}

export interface DerivedPalette {
  mode: SupportedMode;
  tokens: ThemeTokens;
}

function color(value: string): Rgba {
  const parsed = parseColor(value);
  if (!parsed) throw new Error(`[pragma.theme] invalid palette color "${value}"`);
  return parsed;
}

function mapValues<K extends string>(
  source: Record<K, string>,
  fn: (value: Rgba) => Rgba,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(source) as K[]) out[key] = formatColor(fn(color(source[key])));
  return out;
}

/** Derives every color token from a few base colors; the palette must hold valid colors. */
export function derivePalette(palette: ThemePalette): DerivedPalette {
  const bg = { ...color(palette.background), a: 1 };
  const mode: SupportedMode = isDarkColor(bg) ? "dark" : "light";
  const dark = mode === "dark";
  const accent = { ...color(palette.accent), a: 1 };
  const rawFg = color(palette.foreground);
  const tints = accentTints(accent, mode);

  const surface = mix(bg, rawFg, 0.035);
  const elevated = dark ? mix(bg, rawFg, 0.065) : bg;
  const input = dark ? mix(bg, rawFg, 0.045) : bg;
  const surfaces = [bg, surface, elevated, input];

  const fg = ensureContrast(rawFg, surfaces, TEXT_CONTRAST);
  const readable = (c: Rgba) => ensureContrast(c, surfaces, TEXT_CONTRAST);
  const dim = (c: Rgba) => ensureContrast(c, surfaces, DIM_TEXT_CONTRAST);
  const hex = formatColor;
  const alpha = (c: Rgba, a: number) => formatColor(withAlpha(c, a));

  const statusSource = { ...STATUS[mode] };
  for (const key of ["success", "warning", "error", "info"] as const) {
    const custom = palette[key];
    if (custom) statusSource[key] = custom;
  }
  const status = mapValues(statusSource, readable);
  const statusBg = (value: string) => alpha(color(value), dark ? 0.12 : 0.1);

  const ansiColors = mapValues(ANSI[mode].ansi, readable);
  const ansiBright = mapValues(ANSI[mode].bright, readable);
  const muted = readable(mix(fg, bg, 0.3));

  return {
    mode,
    tokens: {
      colors: {
        background: {
          chrome: hex(mix(bg, { r: 0, g: 0, b: 0, a: 1 }, 0.12)),
          root: hex(bg),
          surface: hex(surface),
          elevated: hex(elevated),
          input: hex(input),
          hover: alpha(fg, dark ? 0.06 : 0.05),
          active: tints.active,
          overlay: alpha(dark ? mix(bg, { r: 0, g: 0, b: 0, a: 1 }, 0.8) : fg, dark ? 0.62 : 0.35),
        },
        foreground: {
          default: hex(fg),
          muted: hex(muted),
          subtle: hex(dim(mix(fg, bg, 0.5))),
          inverse: hex(bg),
        },
        accent: {
          default: hex(accent),
          subtle: tints.subtle,
          glow: tints.glow,
        },
        border: {
          default: alpha(fg, dark ? 0.1 : 0.11),
          subtle: alpha(fg, dark ? 0.065 : 0.07),
          focus: tints.focus,
        },
        status: {
          success: status.success,
          successBg: statusBg(status.success),
          warning: status.warning,
          warningBg: statusBg(status.warning),
          error: status.error,
          errorBg: statusBg(status.error),
          info: status.info,
          infoBg: statusBg(status.info),
        },
        git: {
          added: "{colors.status.success}",
          addedBg: "{colors.status.successBg}",
          modified: "{colors.status.warning}",
          modifiedBg: "{colors.status.warningBg}",
          deleted: "{colors.status.error}",
          deletedBg: "{colors.status.errorBg}",
          untracked: "{colors.status.info}",
          untrackedBg: "{colors.status.infoBg}",
          ignored: "{colors.foreground.subtle}",
          conflict: status.conflict,
        },
        thread: { default: "{colors.accent.subtle}", active: "{colors.accent.default}" },
        selection: tints.selection,
        scrollbar: {
          track: "transparent",
          thumb: alpha(fg, dark ? 0.09 : 0.14),
          thumbHover: alpha(fg, dark ? 0.18 : 0.24),
        },
      },
      editor: {
        background: "{colors.background.root}",
        foreground: "{colors.foreground.default}",
        selection: "{colors.selection}",
        cursor: "{colors.accent.default}",
        gutter: {
          background: "{colors.background.root}",
          foreground: "{colors.foreground.subtle}",
          activeBackground: "{colors.background.surface}",
        },
        line: {
          active: alpha(fg, dark ? 0.035 : 0.025),
          highlight: tints.lineHighlight,
        },
        syntax: {
          ...mapValues(SYNTAX[mode], readable),
          comment: "{colors.foreground.subtle}",
          tag: "{colors.status.error}",
        },
      },
      terminal: {
        background: "{colors.background.root}",
        foreground: "{colors.foreground.default}",
        cursor: "{colors.accent.default}",
        cursorAccent: "{colors.background.root}",
        selection: "{colors.selection}",
        ansi: {
          ...ansiColors,
          black: hex(dark ? mix(bg, { r: 0, g: 0, b: 0, a: 1 }, 0.25) : fg),
          white: hex(muted),
        },
        ansiBright: {
          ...ansiBright,
          black: hex(dim(mix(fg, bg, 0.6))),
          white: hex(fg),
        },
      },
      shadows: SHADOWS[mode],
    },
  };
}
