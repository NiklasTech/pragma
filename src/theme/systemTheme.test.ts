import { describe, expect, it } from "vite-plus/test";
import {
  effectiveThemeId,
  followSystemSelection,
  themeSelection,
  type ThemeChoice,
} from "./systemTheme";
import { getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

const contrastDark = getBuiltInTheme("high-contrast-dark") as Theme;
const contrastLight = getBuiltInTheme("high-contrast-light") as Theme;

const fixed: ThemeChoice = {
  theme: "high-contrast-dark",
  followSystemTheme: false,
  lightTheme: "light-default",
  darkTheme: "dark-default",
};
const following: ThemeChoice = { ...fixed, followSystemTheme: true };

describe("theme from the system appearance", () => {
  it("uses the chosen theme while not following the system", () => {
    expect(effectiveThemeId(fixed, "light")).toBe("high-contrast-dark");
    expect(effectiveThemeId(fixed, "dark")).toBe("high-contrast-dark");
  });

  it("switches between the light and the dark theme with the system", () => {
    expect(effectiveThemeId(following, "light")).toBe("light-default");
    expect(effectiveThemeId(following, "dark")).toBe("dark-default");
  });

  it("fills the slot of the selected theme's mode", () => {
    expect(themeSelection(following, contrastLight)).toEqual({ lightTheme: "high-contrast-light" });
    expect(themeSelection(following, contrastDark)).toEqual({ darkTheme: "high-contrast-dark" });
    expect(themeSelection(fixed, contrastLight)).toEqual({
      theme: "high-contrast-light",
      lightTheme: "high-contrast-light",
    });
  });

  it("keeps the visible theme when following is switched on or off", () => {
    expect(followSystemSelection(true, contrastDark)).toEqual({
      followSystemTheme: true,
      darkTheme: "high-contrast-dark",
    });
    expect(followSystemSelection(true, contrastLight)).toEqual({
      followSystemTheme: true,
      lightTheme: "high-contrast-light",
    });
    expect(followSystemSelection(false, contrastLight)).toEqual({
      followSystemTheme: false,
      theme: "high-contrast-light",
    });
  });
});
