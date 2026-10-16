import { useEffect, useMemo } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { themeMode } from "./applyTheme";
import {
  applyEditorColors,
  editorColorsCss,
  editorColorVariables,
  terminalColorVariables,
} from "./editorColors";
import type { SupportedMode, Theme } from "./types";

export interface EditorColorState {
  /** Light or dark mode of the editor's colors, for CodeMirror's dark flag. */
  editorMode: SupportedMode;
  /** Id of the theme terminals take their colors from. */
  terminalThemeId: string;
}

function findTheme(themes: Theme[], id: string): Theme | undefined {
  return id ? themes.find((theme) => theme.metadata.id === id) : undefined;
}

/** Applies the editor and terminal theme choices and the editor color overrides. */
export function useEditorColors(uiTheme: Theme, available: Theme[]): EditorColorState {
  const editorThemeId = useSettingsStore((s) => s.editor.colorTheme);
  const overrides = useSettingsStore((s) => s.editor.colorOverrides);
  const terminalThemeChoice = useSettingsStore((s) => s.terminal.colorTheme);

  const editorTheme = findTheme(available, editorThemeId);
  const terminalTheme = findTheme(available, terminalThemeChoice);

  const css = useMemo(
    () =>
      editorColorsCss(
        editorColorVariables(editorTheme, overrides ?? {}),
        terminalColorVariables(terminalTheme),
      ),
    [editorTheme, overrides, terminalTheme],
  );

  useEffect(() => {
    applyEditorColors(css);
  }, [css]);

  return {
    editorMode: themeMode(editorTheme ?? uiTheme),
    terminalThemeId: (terminalTheme ?? uiTheme).metadata.id,
  };
}
