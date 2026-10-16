import { useEffect, useState } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { themeMode } from "./applyTheme";
import type { SupportedMode, Theme } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export interface ThemeChoice {
  theme: string;
  followSystemTheme: boolean;
  lightTheme: string;
  darkTheme: string;
}

export function effectiveThemeId(choice: ThemeChoice, system: SupportedMode): string {
  if (!choice.followSystemTheme) return choice.theme;
  return system === "dark" ? choice.darkTheme : choice.lightTheme;
}

/** Selecting a theme fills the slot of its mode, so following the system later keeps it. */
export function themeSelection(choice: ThemeChoice, theme: Theme): Partial<ThemeChoice> {
  const id = theme.metadata.id;
  const slot = themeMode(theme) === "dark" ? { darkTheme: id } : { lightTheme: id };
  return choice.followSystemTheme ? slot : { theme: id, ...slot };
}

/** Turning it on keeps the visible theme in its slot; turning it off keeps it as the theme. */
export function followSystemSelection(enabled: boolean, visible: Theme): Partial<ThemeChoice> {
  const id = visible.metadata.id;
  if (!enabled) return { followSystemTheme: false, theme: id };
  const slot = themeMode(visible) === "dark" ? { darkTheme: id } : { lightTheme: id };
  return { followSystemTheme: true, ...slot };
}

export function getSystemMode(): SupportedMode {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function useSystemMode(): SupportedMode {
  const [mode, setMode] = useState(getSystemMode);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const update = () => setMode(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mode;
}

export function applyThemeChoice(change: Partial<ThemeChoice>): void {
  const { theme, ...system } = change;
  const settings = useSettingsStore.getState();
  if (theme !== undefined) settings.setTheme(theme);
  if (Object.keys(system).length > 0) settings.setSystemTheme(system);
}

export function currentThemeChoice(): ThemeChoice {
  const { theme, followSystemTheme, lightTheme, darkTheme } = useSettingsStore.getState();
  return { theme, followSystemTheme, lightTheme, darkTheme };
}
