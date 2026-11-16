import { replaceRetiredTheme } from "@/theme/retiredThemes";
import type { SettingsState } from "./types";

/** Revision 1 moves choices of the retired bundled themes to Pragma Dark or Light. */
export const THEMES_REVISION = 1;

type ThemeIds = Pick<SettingsState, "theme" | "lightTheme" | "darkTheme" | "editor" | "terminal">;

/** Runs once, so a later custom theme that reuses a retired id keeps its place. */
export function migrateRetiredThemes(merged: ThemeIds, revision: number | undefined): ThemeIds {
  if ((revision ?? 0) >= THEMES_REVISION) return merged;
  return {
    theme: replaceRetiredTheme(merged.theme),
    lightTheme: replaceRetiredTheme(merged.lightTheme),
    darkTheme: replaceRetiredTheme(merged.darkTheme),
    editor: { ...merged.editor, colorTheme: replaceRetiredTheme(merged.editor.colorTheme) },
    terminal: { ...merged.terminal, colorTheme: replaceRetiredTheme(merged.terminal.colorTheme) },
  };
}
