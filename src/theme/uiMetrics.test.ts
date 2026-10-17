import { describe, expect, it } from "vite-plus/test";
import { FIXED_TOKENS } from "./fixedTokens";
import {
  clampUiScale,
  DENSITY_TABLE,
  scaleUiSize,
  stepUiScale,
  uiHeaderHeight,
  uiMetricVariables,
  type UiMetricsSettings,
} from "./uiMetrics";
import { uiZoomAction } from "./useUiMetrics";

const defaults: UiMetricsSettings = {
  density: "default",
  uiScale: 100,
  uiFontId: "",
  uiFontFamily: "",
};

function vars(settings: Partial<UiMetricsSettings>): Map<string, string> {
  return new Map(
    uiMetricVariables({ ...defaults, ...settings }).map(({ name, value }) => [name, value]),
  );
}

describe("density table", () => {
  it("keeps today's sizes for the default density", () => {
    const css = vars({});
    expect(css.get("--chrome-header-h")).toBe("40px");
    expect(css.get("--chrome-tab-h")).toBe("36px");
    expect(css.get("--chrome-statusbar-h")).toBe("26px");
    expect(css.get("--chrome-breadcrumb-h")).toBe("28px");
    expect(css.get("--chrome-inputbar-h")).toBe("42px");
    expect(css.get("--chrome-row-h")).toBe("26px");
    expect(css.get("--chrome-sidebar-expanded-w")).toBe("260px");
    expect(css.get("--text-ui-sm")).toBe("13px");
    expect(css.get("--leading-ui-base")).toBe("20px");
    expect(css.get("--text-editor")).toBe("14px");
    expect(css.get("--motion-fast")).toBe("150ms");
    expect(css.get("--spacing")).toBe("0.25rem");
  });

  it("stays in step with the density factor", () => {
    const base = DENSITY_TABLE.default;
    for (const density of ["compact", "comfortable"] as const) {
      const values = DENSITY_TABLE[density];
      for (const key of [
        "headerHeight",
        "tabHeight",
        "statusbarHeight",
        "breadcrumbHeight",
        "inputbarHeight",
        "rowHeight",
      ] as const) {
        expect(
          Math.abs(values[key] - base[key] * values.factor),
          `${density}.${key}`,
        ).toBeLessThanOrEqual(1);
      }
    }
    expect(DENSITY_TABLE.compact.tabHeight).toBeLessThan(DENSITY_TABLE.default.tabHeight);
    expect(DENSITY_TABLE.comfortable.tabHeight).toBeGreaterThan(DENSITY_TABLE.default.tabHeight);
  });

  it("changes heights and spacing but not text size with density", () => {
    const compact = vars({ density: "compact" });
    expect(compact.get("--chrome-tab-h")).toBe("32px");
    expect(compact.get("--spacing")).toBe("0.225rem");
    expect(compact.get("--text-ui-sm")).toBe("13px");
  });

  it("falls back to the default density for unknown values", () => {
    const css = vars({ density: "huge" as UiMetricsSettings["density"] });
    expect(css.get("--chrome-tab-h")).toBe("36px");
  });

  it("matches the layout values the theme used to set", () => {
    expect(DENSITY_TABLE.default.rowHeight).toBe(FIXED_TOKENS.layout.rowHeight);
  });
});

describe("UI scale", () => {
  it("scales UI text, heights and spacing but not the editor font", () => {
    const css = vars({ uiScale: 150 });
    expect(css.get("--text-ui-sm")).toBe("19.5px");
    expect(css.get("--leading-ui-sm")).toBe("27px");
    expect(css.get("--chrome-tab-h")).toBe("54px");
    expect(css.get("--spacing")).toBe("0.375rem");
    expect(css.get("--text-editor")).toBe("14px");
  });

  it("clamps to 80-150 percent in steps of 10", () => {
    expect(clampUiScale(40)).toBe(80);
    expect(clampUiScale(500)).toBe(150);
    expect(clampUiScale(104)).toBe(100);
    expect(clampUiScale(116)).toBe(120);
    expect(clampUiScale(Number.NaN)).toBe(100);
    expect(vars({ uiScale: 999 }).get("--chrome-tab-h")).toBe("54px");
  });

  it("steps up and down within the range", () => {
    expect(stepUiScale(100, 1)).toBe(110);
    expect(stepUiScale(100, -1)).toBe(90);
    expect(stepUiScale(150, 1)).toBe(150);
    expect(stepUiScale(80, -1)).toBe(80);
  });

  it("gives the title bar height that the header variable uses", () => {
    expect(uiHeaderHeight(defaults)).toBe(40);
    expect(uiHeaderHeight({ ...defaults, density: "compact", uiScale: 90 })).toBe(32);
    expect(uiHeaderHeight({ ...defaults, density: "comfortable", uiScale: 150 })).toBe(69);
    expect(vars({ density: "compact", uiScale: 90 }).get("--chrome-header-h")).toBe("32px");
  });

  it("scales virtualized row heights by density and scale", () => {
    expect(scaleUiSize(26, defaults)).toBe(26);
    expect(scaleUiSize(26, { ...defaults, density: "compact" })).toBe(23);
    expect(scaleUiSize(26, { ...defaults, density: "comfortable", uiScale: 120 })).toBe(36);
  });
});

describe("UI font", () => {
  it("puts the chosen font in front of the default stack", () => {
    expect(vars({}).get("--font-ui")).toMatch(/^"Geist Variable"/);
    expect(vars({ uiFontFamily: "Inter" }).get("--font-ui")).toMatch(/^"Inter", "Geist Variable"/);
    expect(vars({ uiFontId: "ibm-plex", uiFontFamily: "x" }).get("--font-ui")).toMatch(
      /^"ibm-plex"/,
    );
  });

  it("strips characters that could break the CSS value", () => {
    expect(vars({ uiFontFamily: 'Evil"; color: red' }).get("--font-ui")).toMatch(
      /^"Evil color: red"/,
    );
  });
});

describe("UI zoom shortcuts", () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = { metaKey: true }) =>
    uiZoomAction({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods });

  it("maps Cmd/Ctrl with plus, minus and zero", () => {
    expect(key("=")).toBe("in");
    expect(key("+")).toBe("in");
    expect(key("-")).toBe("out");
    expect(key("0")).toBe("reset");
    expect(key("0", { ctrlKey: true })).toBe("reset");
  });

  it("ignores keys without the modifier or with Alt", () => {
    expect(key("=", {})).toBeNull();
    expect(key("=", { metaKey: true, altKey: true })).toBeNull();
    expect(key("k")).toBeNull();
  });
});
