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
  const themeId = useSettingsStore((s) => s.theme);
  const setThemeId = useSettingsStore((s) => s.setTheme);

  const customThemes = useSettingsStore((s) => s.customThemes);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);

  const folderEntries = useThemeFolderStore((s) => s.entries);
  const fromFolder = useMemo(() => folderThemes(folderEntries), [folderEntries]);
  useThemeFolderWatcher(showThemeFileErrors);

  const theme = useMemo(
    () => resolveTheme(themeId, customThemes, fromFolder),
    [themeId, customThemes, fromFolder],
  );
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

  const availableThemes = useMemo(
    () => mergeThemeLists(fromFolder, customThemes),
    [customThemes, fromFolder],
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
