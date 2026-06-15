import type { Theme } from "./types";

const STORAGE_KEY = "pragma.themes.custom";

export interface CustomThemesState {
  themes: Record<string, Theme>;
}

function readStorage(): Record<string, Theme> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Theme>;
    return parsed ?? {};
  } catch (error) {
    console.error("[pragma.theme] Failed to load custom themes:", error);
    return {};
  }
}

function writeStorage(themes: Record<string, Theme>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch (error) {
    console.error("[pragma.theme] Failed to save custom themes:", error);
  }
}

export function loadCustomThemes(): Record<string, Theme> {
  return readStorage();
}

export function saveCustomTheme(theme: Theme): void {
  const themes = readStorage();
  themes[theme.metadata.id] = theme;
  writeStorage(themes);
}

export function deleteCustomTheme(id: string): void {
  const themes = readStorage();
  delete themes[id];
  writeStorage(themes);
}

export function getCustomTheme(id: string): Theme | undefined {
  return readStorage()[id];
}

export function exportThemeFile(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}
