import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "@/shared/stores/settings";
import { applyTheme, themeMode } from "./applyTheme";
import { defaultThemeId, getBuiltInTheme } from "./themes";
import { loadCustomThemes } from "./customThemes";
import { themeErrorLines, type ThemeFolderEntry } from "./themeFolder";
import {
  folderThemes,
  mergeThemeLists,
  useThemeFolderStore,
  useThemeFolderWatcher,
} from "./themeFolderStore";
import {
  applyThemeChoice,
  currentThemeChoice,
  effectiveThemeId,
  followSystemSelection,
  themeSelection,
  useSystemMode,
} from "./systemTheme";
import type { Theme } from "./types";

interface ThemeContextValue {
  /** The visible theme; follows the system appearance when `followSystemTheme` is on. */
  themeId: string;
  theme: Theme;
  resolvedMode: "dark" | "light";
  availableThemes: Theme[];
  followSystemTheme: boolean;
  lightThemeId: string;
  darkThemeId: string;
  setTheme: (id: string) => void;
  setFollowSystemTheme: (enabled: boolean) => void;
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(id: string, customThemes: Record<string, Theme>, folder: Theme[]): Theme {
  const builtIn = getBuiltInTheme(id);
  if (builtIn) return builtIn;

  const fromFolder = folder.find((theme) => theme.metadata.id === id);
  if (fromFolder) return fromFolder;

  const custom = customThemes[id];
  if (custom) return custom;

  const fallback = getBuiltInTheme(defaultThemeId);
  if (fallback) return fallback;

  throw new Error(`[pragma.theme] Built-in default theme "${defaultThemeId}" not found`);
}

function showThemeFileErrors(entries: ThemeFolderEntry[]): void {
  for (const entry of entries) {
    const kept = entry.theme ? " The last valid version stays active." : "";
    toast.error(`${entry.fileName} has errors.${kept}`, {
      description: (
        <div className="flex flex-col gap-0.5">
          {themeErrorLines(entry.errors).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ),
    });
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const storedThemeId = useSettingsStore((s) => s.theme);
  const followSystemTheme = useSettingsStore((s) => s.followSystemTheme);
  const lightThemeId = useSettingsStore((s) => s.lightTheme);
  const darkThemeId = useSettingsStore((s) => s.darkTheme);
  const systemMode = useSystemMode();
  const requestedId = effectiveThemeId(
    { theme: storedThemeId, followSystemTheme, lightTheme: lightThemeId, darkTheme: darkThemeId },
    systemMode,
  );

  const customThemes = useSettingsStore((s) => s.customThemes);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);

  const folderEntries = useThemeFolderStore((s) => s.entries);
  const fromFolder = useMemo(() => folderThemes(folderEntries), [folderEntries]);
  useThemeFolderWatcher(showThemeFileErrors);

  const theme = useMemo(
    () => resolveTheme(requestedId, customThemes, fromFolder),
    [requestedId, customThemes, fromFolder],
  );
  const themeId = theme.metadata.id;
  const resolvedMode = themeMode(theme);

  // Apply theme colors and its dark/light class whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const availableThemes = useMemo(
    () => mergeThemeLists(fromFolder, customThemes),
    [customThemes, fromFolder],
  );

  const handleSetTheme = useCallback(
    (id: string) => {
      const selected = availableThemes.find((t) => t.metadata.id === id);
      if (selected) applyThemeChoice(themeSelection(currentThemeChoice(), selected));
    },
    [availableThemes],
  );

  const handleFollowSystem = useCallback(
    (enabled: boolean) => applyThemeChoice(followSystemSelection(enabled, theme)),
    [theme],
  );

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
    followSystemTheme,
    lightThemeId,
    darkThemeId,
    setTheme: handleSetTheme,
    setFollowSystemTheme: handleFollowSystem,
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
