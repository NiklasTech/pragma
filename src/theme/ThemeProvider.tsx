import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSettingsStore, type ThemeMode } from "@/shared/stores/settings";
import { applyTheme } from "./applyTheme";
import { builtInThemeList, defaultThemeId, getBuiltInTheme } from "./themes";
import { loadCustomThemes } from "./customThemes";
import type { Theme } from "./types";

interface ThemeContextValue {
  themeId: string;
  theme: Theme;
  mode: ThemeMode;
  resolvedMode: "dark" | "light";
  availableThemes: Theme[];
  setTheme: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") return getSystemMode();
  return mode;
}

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
  const mode = useSettingsStore((s) => s.themeMode);
  const setThemeId = useSettingsStore((s) => s.setTheme);
  const setMode = useSettingsStore((s) => s.setThemeMode);

  const customThemes = useSettingsStore((s) => s.customThemes);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);

  const resolvedMode = useMemo(() => resolveMode(mode), [mode]);
  const theme = useMemo(() => resolveTheme(themeId, customThemes), [themeId, customThemes]);

  // Apply theme whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply dark/light class to <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolvedMode);
  }, [resolvedMode]);

  // Listen for system color scheme changes when in system mode.
  useEffect(() => {
    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      // Force re-render by updating state? resolvedMode is derived from mode,
      // but system mode needs an extra nudge. We keep a tick state.
      setSystemTick((t) => t + 1);
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [mode]);

  const [systemTick, setSystemTick] = useState(0);

  // Derive resolved mode again after system tick.
  const finalResolvedMode = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    systemTick;
    return resolveMode(mode);
  }, [mode, systemTick]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(finalResolvedMode);
  }, [finalResolvedMode]);

  const handleSetTheme = useCallback(
    (id: string) => {
      setThemeId(id);
    },
    [setThemeId],
  );

  const handleSetMode = useCallback(
    (next: ThemeMode) => {
      setMode(next);
    },
    [setMode],
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
    mode,
    resolvedMode: finalResolvedMode,
    availableThemes,
    setTheme: handleSetTheme,
    setMode: handleSetMode,
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
