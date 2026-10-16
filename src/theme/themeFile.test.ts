import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables, themeMode } from "./applyTheme";
import { contrastRatio, parseColor } from "./color";
import { resolveThemeFile, type ThemeResolution } from "./themeFile";
import { lookupIn } from "./themeFolder";
import { builtInThemeList } from "./themes";
import type { Theme } from "./types";

const lookup = lookupIn(builtInThemeList);
const nord = builtInThemeList.find((theme) => theme.metadata.id === "nord") as Theme;

function ok(result: ThemeResolution): Theme {
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.theme;
}

function vars(theme: Theme): Map<string, string> {
  return new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
}

function ratio(fg: string | undefined, bg: string | undefined): number {
  const f = parseColor(fg ?? "");
  const b = parseColor(bg ?? "");
  if (!f || !b) throw new Error(`not a color: ${fg} on ${bg}`);
  return contrastRatio(f, b);
}

const meta = { id: "mine", name: "Mine" };

describe("extends", () => {
  it("takes every missing token from the base theme", () => {
    const theme = ok(
      resolveThemeFile({ format: "pragma-theme-v1", metadata: meta, extends: "nord" }, lookup),
    );
    expect(theme.tokens).toEqual(nord.tokens);
    expect(theme.appearance).toEqual(nord.appearance);
    expect(theme.metadata).toEqual(meta);
  });

  it("shows a new accent everywhere the base theme used its accent", () => {
    const theme = ok(
      resolveThemeFile(
        {
          format: "pragma-theme-v1",
          metadata: meta,
          extends: "nord",
          tokens: { colors: { accent: { default: "#ff00aa" } } },
        },
        lookup,
      ),
    );
    const css = vars(theme);
    expect(css.get("--color-accent")).toBe("#ff00aa");
    expect(css.get("--editor-cursor")).toBe("#ff00aa");
    expect(css.get("--color-thread-active")).toBe("#ff00aa");
    expect(css.get("--color-accent-subtle")).toBe("rgba(255, 0, 170, 0.14)");
    expect(css.get("--border-focus")).toBe("rgba(255, 0, 170, 0.5)");
    expect(css.get("--editor-selection")).toBe("rgba(255, 0, 170, 0.25)");
    // The built-in theme itself stays untouched.
    expect(nord.tokens.colors.accent.subtle).toBe("rgba(136, 192, 208, 0.14)");
  });

  it("keeps tinted tokens the extending theme sets itself", () => {
    const theme = ok(
      resolveThemeFile(
        {
          format: "pragma-theme-v1",
          metadata: meta,
          extends: "nord",
          tokens: { colors: { accent: { default: "#ff00aa" }, selection: "#123456" } },
        },
        lookup,
      ),
    );
    expect(theme.tokens.colors.selection).toBe("#123456");
  });

  it("reports an unknown base theme", () => {
    expect(
      resolveThemeFile({ format: "pragma-theme-v1", metadata: meta, extends: "nope" }, lookup),
    ).toEqual({ ok: false, errors: ['extends: unknown theme "nope"'] });
  });

  it("validates the overrides", () => {
    const result = resolveThemeFile(
      {
        format: "pragma-theme-v1",
        metadata: meta,
        extends: "nord",
        tokens: { colors: { accent: { default: "pink" } } },
      },
      lookup,
    );
    expect(result).toEqual({
      ok: false,
      errors: ['tokens.colors.accent.default: invalid color value "pink"'],
    });
  });
});

describe("palette", () => {
  const cases: [string, Record<string, string>][] = [
    ["dark", { background: "#1e1e2e", foreground: "#cdd6f4", accent: "#f5c2e7" }],
    ["light", { background: "#fdf6e3", foreground: "#657b83", accent: "#268bd2" }],
    ["low-contrast dark", { background: "#333333", foreground: "#555555", accent: "#444444" }],
    ["low-contrast light", { background: "#dddddd", foreground: "#bbbbbb", accent: "#cccccc" }],
  ];

  for (const [label, palette] of cases) {
    it(`derives a valid, readable ${label} theme from three colors`, () => {
      const theme = ok(
        resolveThemeFile({ format: "pragma-theme-v1", metadata: meta, palette }, lookup),
      );
      const css = vars(theme);
      const bg = css.get("--bg-root");
      expect(bg).toBe(palette.background);
      expect(ratio(css.get("--fg-default"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--fg-default"), css.get("--bg-elevated"))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--fg-muted"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--editor-fg"), css.get("--editor-bg"))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(css.get("--terminal-fg"), css.get("--terminal-bg"))).toBeGreaterThanOrEqual(4.5);
      for (const token of ["keyword", "string", "function", "number", "type", "operator"]) {
        expect(ratio(css.get(`--syntax-${token}`), bg)).toBeGreaterThanOrEqual(4.5);
      }
      for (const color of ["red", "green", "yellow", "blue", "magenta", "cyan"]) {
        expect(ratio(css.get(`--terminal-ansi-${color}`), bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("picks the mode from the background", () => {
    const resolve = (background: string) =>
      ok(
        resolveThemeFile(
          {
            format: "pragma-theme-v1",
            metadata: meta,
            palette: { background, foreground: "#888888", accent: "#2f9bff" },
          },
          lookup,
        ),
      );
    expect(themeMode(resolve("#101010"))).toBe("dark");
    expect(themeMode(resolve("#fafafa"))).toBe("light");
  });

  it("uses given status colors and lets explicit tokens win", () => {
    const theme = ok(
      resolveThemeFile(
        {
          format: "pragma-theme-v1",
          metadata: meta,
          palette: {
            background: "#101010",
            foreground: "#eeeeee",
            accent: "#2f9bff",
            error: "#ff5555",
          },
          tokens: { colors: { foreground: { muted: "#abcdef" } } },
        },
        lookup,
      ),
    );
    expect(theme.tokens.colors.status.error).toBe("#ff5555");
    expect(theme.tokens.colors.foreground.muted).toBe("#abcdef");
  });

  it("rejects missing or invalid palette colors", () => {
    expect(
      resolveThemeFile(
        {
          format: "pragma-theme-v1",
          metadata: meta,
          palette: { background: "#000", accent: "red" },
        },
        lookup,
      ),
    ).toEqual({
      ok: false,
      errors: [
        "palette.foreground: must be a hex or rgb color",
        "palette.accent: must be a hex or rgb color",
      ],
    });
  });

  it("rejects combining palette and extends", () => {
    const result = resolveThemeFile(
      {
        format: "pragma-theme-v1",
        metadata: meta,
        extends: "nord",
        palette: { background: "#000000", foreground: "#ffffff", accent: "#2f9bff" },
      },
      lookup,
    );
    expect(result).toEqual({ ok: false, errors: ["palette: cannot be combined with extends"] });
  });
});
