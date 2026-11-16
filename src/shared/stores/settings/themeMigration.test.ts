import { describe, expect, it } from "vite-plus/test";
import { builtInThemeList } from "@/theme/themes";
import { RETIRED_THEME_IDS, replaceRetiredTheme } from "@/theme/retiredThemes";
import { useSettingsStore } from "../settings";
import { mergeWithDefaults } from "./migrations";

const defaults = useSettingsStore.getState();

describe("retired themes", () => {
  it("never retires a theme Pragma still ships", () => {
    for (const theme of builtInThemeList) {
      expect(RETIRED_THEME_IDS).not.toContain(theme.metadata.id);
    }
  });

  it("moves each retired theme to Pragma Dark or Light by its mode", () => {
    expect(replaceRetiredTheme("nord")).toBe("dark-default");
    expect(replaceRetiredTheme("solarized-light")).toBe("light-default");
    expect(replaceRetiredTheme("my-theme")).toBe("my-theme");
    expect(replaceRetiredTheme("")).toBe("");
  });

  it("migrates the UI, follow-system, editor and terminal choices once", () => {
    const merged = mergeWithDefaults(
      {
        theme: "dracula",
        lightTheme: "paper-light",
        darkTheme: "high-contrast-dark",
        editor: { colorTheme: "one-dark" },
        terminal: { colorTheme: "github-light" },
      },
      defaults,
    );
    expect(merged.theme).toBe("dark-default");
    expect(merged.lightTheme).toBe("light-default");
    expect(merged.darkTheme).toBe("high-contrast-dark");
    expect(merged.editor.colorTheme).toBe("dark-default");
    expect(merged.terminal.colorTheme).toBe("light-default");
    expect(merged.themesRevision).toBe(1);
  });

  it("keeps a custom theme that reuses a retired id after the migration ran", () => {
    const merged = mergeWithDefaults({ theme: "nord", themesRevision: 1 }, defaults);
    expect(merged.theme).toBe("nord");
  });
});
