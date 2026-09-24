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
  } catch {
    return {};
  }
}

function writeStorage(themes: Record<string, Theme>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch {}
}

export function loadCustomThemes(): Record<string, Theme> {
  return readStorage();
}

export function deleteCustomTheme(id: string): void {
  const themes = readStorage();
  delete themes[id];
  writeStorage(themes);
}
