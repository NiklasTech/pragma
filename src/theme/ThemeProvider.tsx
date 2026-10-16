import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { applyTheme, themeMode } from "./applyTheme";
import { builtInThemeList, defaultThemeId, getBuiltInTheme } from "./themes";
import { loadCustomThemes } from "./customThemes";
import type { Theme } from "./types";

interface ThemeContextValue {
  themeId: string;
  theme: Theme;
  resolvedMode: "dark" | "light";
  availableThemes: Theme[];
  setTheme: (id: string) => void;
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(id: string, customThemes: Record<string, Theme>): Theme {
  const builtIn = getBuiltInTheme(id);
  if (builtIn) return builtIn;

  const custom = customThemes[id];
  if (custom) return custom;

  const fallback = getBuiltInTheme(defaultThemeId);
  if (fallback) return fallback;

  throw new Error(`[pragma.theme] Built-in default theme "${defaultThemeId}" not found`);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeId = useSettingsStore((s) => s.theme);
  const setThemeId = useSettingsStore((s) => s.setTheme);

  const customThemes = useSettingsStore((s) => s.customThemes);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);

  const theme = useMemo(() => resolveTheme(themeId, customThemes), [themeId, customThemes]);
  const resolvedMode = themeMode(theme);

  // Apply theme colors and its dark/light class whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleSetTheme = useCallback(
    (id: string) => {
      setThemeId(id);
    },
    [setThemeId],
  );

  const availableThemes = useMemo(() => {
    return [...builtInThemeList, ...Object.values(customThemes)];
  }, [customThemes]);

  // One-time migration: legacy custom themes stored in localStorage are
  // imported into the synchronized settings store.
  useEffect(() => {
    const legacy = loadCustomThemes();
    const legacyKeys = Object.keys(legacy);
    if (legacyKeys.length === 0) return;
    const state = useSettingsStore.getState();
    const missing = legacyKeys.filter((id) => !(id in state.customThemes));
    if (missing.length === 0) return;
    for (const id of missing) {
      addCustomTheme(legacy[id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: ThemeContextValue = {
    themeId,
    theme,
    resolvedMode,
    availableThemes,
    setTheme: handleSetTheme,
    addCustomTheme,
    deleteCustomTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("[pragma.theme] useTheme must be used within ThemeProvider");
  }
  return context;
}
