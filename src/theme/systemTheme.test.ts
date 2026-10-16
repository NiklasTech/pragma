import { describe, expect, it } from "vite-plus/test";
import {
  effectiveThemeId,
  followSystemSelection,
  themeSelection,
  type ThemeChoice,
} from "./systemTheme";
import { getBuiltInTheme } from "./themes";
import type { Theme } from "./types";

const nord = getBuiltInTheme("nord") as Theme;
const paper = getBuiltInTheme("paper-light") as Theme;

const fixed: ThemeChoice = {
  theme: "nord",
  followSystemTheme: false,
  lightTheme: "light-default",
  darkTheme: "dark-default",
};
const following: ThemeChoice = { ...fixed, followSystemTheme: true };

describe("theme from the system appearance", () => {
  it("uses the chosen theme while not following the system", () => {
    expect(effectiveThemeId(fixed, "light")).toBe("nord");
    expect(effectiveThemeId(fixed, "dark")).toBe("nord");
  });

  it("switches between the light and the dark theme with the system", () => {
    expect(effectiveThemeId(following, "light")).toBe("light-default");
    expect(effectiveThemeId(following, "dark")).toBe("dark-default");
  });

  it("fills the slot of the selected theme's mode", () => {
    expect(themeSelection(following, paper)).toEqual({ lightTheme: "paper-light" });
    expect(themeSelection(following, nord)).toEqual({ darkTheme: "nord" });
    expect(themeSelection(fixed, paper)).toEqual({
      theme: "paper-light",
      lightTheme: "paper-light",
    });
  });

  it("keeps the visible theme when following is switched on or off", () => {
    expect(followSystemSelection(true, nord)).toEqual({
      followSystemTheme: true,
      darkTheme: "nord",
    });
    expect(followSystemSelection(true, paper)).toEqual({
      followSystemTheme: true,
      lightTheme: "paper-light",
    });
    expect(followSystemSelection(false, paper)).toEqual({
      followSystemTheme: false,
      theme: "paper-light",
    });
  });
});
