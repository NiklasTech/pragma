import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables, themeMode } from "./applyTheme";
import { builtInThemeList } from "./themes";
import darkDefault from "./themes/dark-default.json";
import type { Theme } from "./types";

function cssVars(theme: Theme): Map<string, string> {
  return new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
}

describe("layout theme tokens", () => {
  it("emits layout sizes as CSS pixel lengths for every built-in theme", () => {
    for (const theme of builtInThemeList) {
      const vars = cssVars(theme);
      expect(vars.get("--chrome-header-h")).toBe("40px");
      expect(vars.get("--chrome-tab-h")).toBe("36px");
      expect(vars.get("--chrome-statusbar-h")).toBe("26px");
      expect(vars.get("--bg-chrome")).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("ignores layout, typography and motion from older theme files", () => {
    const legacy = {
      ...structuredClone(darkDefault),
      tokens: {
        ...structuredClone(darkDefault).tokens,
        layout: { tabHeight: 4, rowHeight: 2 },
        typography: { ui: { base: "2px" }, editor: "3px" },
        motion: { duration: { fast: "5s" } },
      },
    } as Theme;

    const vars = cssVars(legacy);
    expect(vars.get("--chrome-tab-h")).toBe("36px");
    expect(vars.get("--chrome-row-h")).toBe("26px");
    expect(vars.get("--text-ui-base")).toBe("13px");
    expect(vars.get("--text-editor")).toBe("14px");
    expect(vars.get("--motion-fast")).toBe("150ms");
  });
});

describe("theme mode", () => {
  it("uses light for the light built-in themes and dark for all others", () => {
    const light = builtInThemeList
      .filter((theme) => themeMode(theme) === "light")
      .map((theme) => theme.metadata.id)
      .sort();
    expect(light).toEqual([
      "arctic-light",
      "ayu-light",
      "catppuccin-latte",
      "everforest-light",
      "github-light",
      "gruvbox-light",
      "light-default",
      "paper-light",
      "rose-pine-dawn",
      "solarized-light",
      "tokyo-night-day",
    ]);
  });

  it("falls back to the first supported mode for a system theme", () => {
    const theme = {
      ...structuredClone(darkDefault),
      appearance: { defaultMode: "system", supportedModes: ["light", "dark"] },
    } as Theme;
    expect(themeMode(theme)).toBe("light");
  });
});
