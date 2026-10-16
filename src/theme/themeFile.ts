import { formatColor, parseColor, withAlpha } from "./color";
import { derivePalette } from "./palette";
import type { Theme, ThemeAppearance, ThemeFile, ThemeInput, ThemeTokens } from "./types";
import { validateTheme } from "./validateTheme";

const FORMAT = "pragma-theme-v1";
const PALETTE_REQUIRED = ["background", "foreground", "accent"] as const;
const PALETTE_OPTIONAL = ["success", "warning", "error", "info"] as const;

// Accent-tinted tokens that follow a new accent unless the extending theme sets them itself.
const ACCENT_TINTED: [string[], number][] = [
  [["colors", "accent", "subtle"], 0.14],
  [["colors", "accent", "glow"], 0.3],
  [["colors", "border", "focus"], 0.5],
  [["colors", "selection"], 0.22],
  [["colors", "background", "active"], 0.14],
];

export type ThemeResolution = { ok: true; theme: Theme } | { ok: false; errors: string[] };

/** Looks up a base theme by id, or reports why it cannot be used. */
export type ThemeLookup = (id: string) => Theme | string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) return override === undefined ? base : override;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function getPath(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const part of path) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (const part of path.slice(0, -1)) {
    const next = current[part];
    if (!isRecord(next)) return;
    current = next;
  }
  current[path[path.length - 1]] = value;
}

function validateFileShape(file: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (file.format !== FORMAT) errors.push(`format: must be "${FORMAT}"`);

  const metadata = file.metadata;
  if (!isRecord(metadata)) {
    errors.push("metadata: must be an object");
  } else {
    if (typeof metadata.id !== "string" || !/^[a-z0-9-]+$/.test(metadata.id)) {
      errors.push("metadata.id: must contain only lowercase letters, numbers, and hyphens");
    }
    if (typeof metadata.name !== "string") errors.push("metadata.name: must be a string");
  }

  if (file.extends !== undefined && typeof file.extends !== "string") {
    errors.push("extends: must be a theme id");
  }
  if (file.extends !== undefined && file.palette !== undefined) {
    errors.push("palette: cannot be combined with extends");
  }
  if (file.tokens !== undefined && !isRecord(file.tokens)) errors.push("tokens: must be an object");

  if (file.palette !== undefined) {
    const palette = file.palette;
    if (!isRecord(palette)) {
      errors.push("palette: must be an object");
    } else {
      for (const key of [...PALETTE_REQUIRED, ...PALETTE_OPTIONAL]) {
        const value = palette[key];
        const required = (PALETTE_REQUIRED as readonly string[]).includes(key);
        if (value === undefined && !required) continue;
        if (typeof value !== "string" || !parseColor(value)) {
          errors.push(`palette.${key}: must be a hex or rgb color`);
        }
      }
    }
  }
  return errors;
}

function retintAccent(tokens: Record<string, unknown>, file: ThemeFile, base: ThemeTokens): void {
  const newAccent = file.tokens?.colors?.accent?.default;
  if (!newAccent || newAccent === base.colors.accent.default) return;
  const accent = parseColor(newAccent);
  if (!accent) return;
  for (const [path, defaultAlpha] of ACCENT_TINTED) {
    if (getPath(file.tokens, path) !== undefined) continue;
    const baseValue = getPath(base, path);
    const parsed = typeof baseValue === "string" ? parseColor(baseValue) : null;
    setPath(tokens, path, formatColor(withAlpha(accent, parsed?.a ?? defaultAlpha)));
  }
}

/** Turns a theme file into a complete theme; `lookup` resolves the theme named in `extends`. */
export function resolveThemeFile(raw: unknown, lookup: ThemeLookup): ThemeResolution {
  if (!isRecord(raw)) return { ok: false, errors: ["The file does not contain a theme object."] };
  const shapeErrors = validateFileShape(raw);
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };

  const file = raw as unknown as ThemeFile;
  let baseTokens: ThemeTokens | undefined;
  let baseAppearance: ThemeAppearance | undefined;

  if (file.extends !== undefined) {
    const base = lookup(file.extends);
    if (typeof base === "string") return { ok: false, errors: [`extends: ${base}`] };
    baseTokens = base.tokens;
    baseAppearance = base.appearance;
  } else if (file.palette !== undefined) {
    const derived = derivePalette(file.palette);
    baseTokens = derived.tokens;
    baseAppearance = { defaultMode: derived.mode, supportedModes: [derived.mode] };
  }

  // Cloned so retinting never writes into the shared base theme objects.
  const merged = deepMerge(structuredClone(baseTokens ?? {}), file.tokens ?? {}) as Record<
    string,
    unknown
  >;
  if (baseTokens && file.extends !== undefined) retintAccent(merged, file, baseTokens);

  // Older files may still carry sizes, fonts and motion; themes only define colors now.
  const { colors, editor, terminal, shadows } = merged as unknown as ThemeTokens;
  const theme = {
    format: FORMAT,
    metadata: file.metadata,
    appearance: file.appearance ?? baseAppearance,
    tokens: { colors, editor, terminal, ...(shadows ? { shadows } : {}) },
  } as Theme;

  const result = validateTheme(theme as ThemeInput);
  return result.valid ? { ok: true, theme } : { ok: false, errors: result.errors };
}
