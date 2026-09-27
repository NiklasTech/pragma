import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables } from "./applyTheme";
import { builtInThemeList } from "./themes";

describe("layout theme tokens", () => {
  it("emits layout sizes as CSS pixel lengths for every built-in theme", () => {
    for (const theme of builtInThemeList) {
      const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
      expect(vars.get("--chrome-header-h")).toBe("40px");
      expect(vars.get("--chrome-tab-h")).toBe("36px");
      expect(vars.get("--chrome-statusbar-h")).toBe("26px");
      expect(vars.get("--bg-chrome")).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
