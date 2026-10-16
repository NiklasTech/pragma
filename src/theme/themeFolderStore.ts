import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/shared/stores/settings";
import { builtInThemeList } from "./themes";
import { loadThemeFolder, type ThemeFileSource, type ThemeFolderEntries } from "./themeFolder";
import type { Theme } from "./types";

const CHANGE_EVENT = "theme-files-changed";
const RELOAD_DELAY_MS = 150;
const BUILT_IN_IDS = new Set(builtInThemeList.map((theme) => theme.metadata.id));

interface ThemeFolderState {
  entries: ThemeFolderEntries;
}

// Persisted so a theme from the folder is already there on the next start, before the reload.
export const useThemeFolderStore = create<ThemeFolderState>()(
  persist(() => ({ entries: {} }), { name: "pragma.themes.folder" }),
);

export function folderThemes(entries: ThemeFolderEntries): Theme[] {
  return Object.values(entries).flatMap((entry) => (entry.theme ? [entry.theme] : []));
}

/** Built-in, folder and stored themes; a folder theme hides a stored one with the same id. */
export function mergeThemeLists(folder: Theme[], stored: Record<string, Theme>): Theme[] {
  const folderIds = new Set(folder.map((theme) => theme.metadata.id));
  const rest = Object.values(stored).filter((theme) => !folderIds.has(theme.metadata.id));
  return [...builtInThemeList, ...folder, ...rest];
}

export function folderEntryForTheme(
  entries: ThemeFolderEntries,
  id: string,
): ThemeFolderEntries[string] | undefined {
  return Object.values(entries).find((entry) => entry.theme?.metadata.id === id);
}

/** Reloads the themes folder and returns the files whose errors changed. */
export async function reloadThemeFolder(): Promise<ThemeFolderEntries[string][]> {
  const files = await invoke<ThemeFileSource[]>("theme_files_list");
  const known = [...builtInThemeList, ...Object.values(useSettingsStore.getState().customThemes)];
  const previous = useThemeFolderStore.getState().entries;
  const entries = loadThemeFolder(files, known, BUILT_IN_IDS, previous);
  useThemeFolderStore.setState({ entries });
  return Object.values(entries).filter(
    (entry) =>
      entry.errors.length > 0 &&
      entry.errors.join("\n") !== previous[entry.fileName]?.errors.join("\n"),
  );
}

/** Loads the themes folder and reloads it whenever a file in it changes. */
export function useThemeFolderWatcher(
  onErrors: (entries: ThemeFolderEntries[string][]) => void,
): void {
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      reloadThemeFolder()
        .then((failed) => {
          if (!disposed && failed.length > 0) onErrors(failed);
        })
        .catch(() => {});
    };

    void invoke("theme_files_watch").catch(() => {});
    reload();
    const unlisten = listen(CHANGE_EVENT, () => {
      clearTimeout(timer);
      timer = setTimeout(reload, RELOAD_DELAY_MS);
    });

    return () => {
      disposed = true;
      clearTimeout(timer);
      void unlisten.then((stop) => stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
