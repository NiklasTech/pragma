import { cssVarName, withTokenUnit } from "./cssVariableMap";
import { FIXED_TOKENS } from "./fixedTokens";
import { flattenTokens, type CssVariableMapping } from "./tokenResolution";

export type UiDensity = "compact" | "default" | "comfortable";

export const UI_DENSITIES: UiDensity[] = ["compact", "default", "comfortable"];
export const UI_SCALE_MIN = 80;
export const UI_SCALE_MAX = 150;
export const UI_SCALE_STEP = 10;
export const UI_SCALE_DEFAULT = 100;

export interface UiMetricsSettings {
  density: UiDensity;
  uiScale: number;
  uiFontId: string;
  uiFontFamily: string;
}

interface DensityValues {
  /** Multiplies Tailwind spacing and every virtualized row height. */
  factor: number;
  headerHeight: number;
  tabHeight: number;
  statusbarHeight: number;
  breadcrumbHeight: number;
  inputbarHeight: number;
  rowHeight: number;
  padding: { xs: number; sm: number; md: number; lg: number };
}

export const DENSITY_TABLE: Record<UiDensity, DensityValues> = {
  compact: {
    factor: 0.9,
    headerHeight: 36,
    tabHeight: 32,
    statusbarHeight: 23,
    breadcrumbHeight: 25,
    inputbarHeight: 38,
    rowHeight: 23,
    padding: { xs: 4, sm: 5, md: 7, lg: 11 },
  },
  default: {
    factor: 1,
    headerHeight: FIXED_TOKENS.layout.headerHeight,
    tabHeight: FIXED_TOKENS.layout.tabHeight,
    statusbarHeight: FIXED_TOKENS.layout.statusbarHeight,
    breadcrumbHeight: FIXED_TOKENS.layout.breadcrumbHeight,
    inputbarHeight: FIXED_TOKENS.layout.inputbarHeight,
    rowHeight: FIXED_TOKENS.layout.rowHeight,
    padding: FIXED_TOKENS.layout.padding,
  },
  comfortable: {
    factor: 1.15,
    headerHeight: 46,
    tabHeight: 41,
    statusbarHeight: 30,
    breadcrumbHeight: 32,
    inputbarHeight: 48,
    rowHeight: 30,
    padding: { xs: 5, sm: 7, md: 9, lg: 14 },
  },
};

const UI_FONT_FALLBACK =
  '"Geist Variable", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function isUiDensity(value: unknown): value is UiDensity {
  return typeof value === "string" && (UI_DENSITIES as string[]).includes(value);
}

/** Rounds to the nearest step and keeps the scale between 80 and 150 percent. */
export function clampUiScale(value: number): number {
  if (!Number.isFinite(value)) return UI_SCALE_DEFAULT;
  const stepped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, stepped));
}

export function stepUiScale(current: number, direction: 1 | -1): number {
  return clampUiScale(clampUiScale(current) + direction * UI_SCALE_STEP);
}

function normalize(settings: UiMetricsSettings): { density: DensityValues; scale: number } {
  const density = DENSITY_TABLE[isUiDensity(settings.density) ? settings.density : "default"];
  return { density, scale: clampUiScale(settings.uiScale) / 100 };
}

/** Scales a design-time pixel size of a row or bar by density and UI scale. */
export function scaleUiSize(px: number, settings: UiMetricsSettings): number {
  const { density, scale } = normalize(settings);
  return Math.round(px * density.factor * scale);
}

function scalePx(value: string, scale: number): string {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
  if (!match || scale === 1) return value;
  return `${Math.round(Number(match[1]) * scale * 100) / 100}px`;
}

export function uiFontStack(settings: UiMetricsSettings): string {
  const family = (settings.uiFontId || settings.uiFontFamily).replace(/["\\;{}]/g, "").trim();
  return family ? `"${family}", ${UI_FONT_FALLBACK}` : UI_FONT_FALLBACK;
}

/** CSS variables for sizes, UI text, motion and the UI font; the theme only sets colors. */
export function uiMetricVariables(settings: UiMetricsSettings): CssVariableMapping[] {
  const { density, scale } = normalize(settings);
  const px = (value: number) => Math.round(value * scale);
  const { layout, typography, motion } = FIXED_TOKENS;

  const tokens = {
    layout: {
      ...layout,
      headerHeight: px(density.headerHeight),
      tabHeight: px(density.tabHeight),
      statusbarHeight: px(density.statusbarHeight),
      breadcrumbHeight: px(density.breadcrumbHeight),
      inputbarHeight: px(density.inputbarHeight),
      rowHeight: px(density.rowHeight),
      sidebarWidth: px(layout.sidebarWidth),
      sidebarCollapsedWidth: px(layout.sidebarCollapsedWidth),
      sidebarMinWidth: px(layout.sidebarMinWidth),
      sidebarMaxWidth: px(layout.sidebarMaxWidth),
      panelMinHeight: px(layout.panelMinHeight),
      panelDefaultHeight: px(layout.panelDefaultHeight),
      padding: {
        xs: px(density.padding.xs),
        sm: px(density.padding.sm),
        md: px(density.padding.md),
        lg: px(density.padding.lg),
      },
    },
    typography: {
      ...typography,
      // The editor keeps its own font size setting.
      ui: Object.fromEntries(
        Object.entries(typography.ui).map(([key, value]) => [key, scalePx(value, scale)]),
      ),
      lineHeight: {
        ...typography.lineHeight,
        ui: Object.fromEntries(
          Object.entries(typography.lineHeight.ui).map(([key, value]) => [
            key,
            scalePx(value, scale),
          ]),
        ),
      },
    },
    motion,
  };

  const mappings: CssVariableMapping[] = [];
  flattenTokens("", tokens, mappings, (value) => value);
  const vars = mappings.map(({ name, value }) => ({
    name: cssVarName(name),
    value: withTokenUnit(name, value),
  }));

  const spacing = Math.round(0.25 * density.factor * scale * 10000) / 10000;
  vars.push({ name: "--spacing", value: `${spacing}rem` });
  vars.push({ name: "--font-ui", value: uiFontStack(settings) });
  return vars;
}

export function applyUiMetrics(settings: UiMetricsSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const { name, value } of uiMetricVariables(settings)) {
    root.style.setProperty(name, value);
  }
}
