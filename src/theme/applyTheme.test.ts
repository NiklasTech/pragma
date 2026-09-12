import { describe, expect, it } from "vite-plus/test";
import { generateCssVariables } from "./applyTheme";
import { builtInThemeList } from "./themes";

describe("layout theme tokens", () => {
  it("emits the tab height as a CSS pixel length for every built-in theme", () => {
    for (const theme of builtInThemeList) {
      const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
      expect(vars.get("--chrome-tab-h")).toBe("44px");
    }
  });
});
