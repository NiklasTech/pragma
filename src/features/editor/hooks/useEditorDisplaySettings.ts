import { useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  bracketColorsCompartment,
  cursorCompartment,
  indentGuidesCompartment,
  ligaturesCompartment,
  lineHeightCompartment,
  overviewCompartment,
  rulersCompartment,
  whitespaceCompartment,
} from "@/features/editor/compartments";
import {
  cursorExtension,
  ligaturesExtension,
  lineHeightExtension,
  renderWhitespaceExtension,
  rulersExtension,
} from "@/features/editor/components/extensions/display-settings";
import { indentGuidesExtension } from "@/features/editor/components/extensions/indent-guides";
import { bracketColorsExtension } from "@/features/editor/components/extensions/bracket-colors";
import { overviewRulerExtension } from "@/features/editor/components/extensions/overview-ruler";
import { useEditorSetting } from "@/shared/stores/workspaceSettings/effective";

/** Applies the editor display settings to a mounted view without recreating it. */
export function useEditorDisplaySettings(view: EditorView | null): void {
  const renderWhitespace = useSettingsStore((state) => state.editor.renderWhitespace);
  const rulers = useEditorSetting("rulers");
  const indentGuides = useSettingsStore((state) => state.editor.indentGuides);
  const bracketColors = useSettingsStore((state) => state.editor.bracketPairColorization);
  const cursorStyle = useSettingsStore((state) => state.editor.cursorStyle);
  const cursorBlinking = useSettingsStore((state) => state.editor.cursorBlinking);
  const lineHeight = useSettingsStore((state) => state.editor.lineHeight);
  const fontLigatures = useSettingsStore((state) => state.editor.fontLigatures);
  const overviewMarkers = useSettingsStore((state) => state.editor.overviewMarkers);

  useEffect(() => {
    view?.dispatch({
      effects: whitespaceCompartment.reconfigure(renderWhitespaceExtension(renderWhitespace)),
    });
  }, [view, renderWhitespace]);

  useEffect(() => {
    view?.dispatch({ effects: rulersCompartment.reconfigure(rulersExtension(rulers)) });
  }, [view, rulers]);

  useEffect(() => {
    view?.dispatch({
      effects: indentGuidesCompartment.reconfigure(indentGuides ? indentGuidesExtension() : []),
    });
  }, [view, indentGuides]);

  useEffect(() => {
    view?.dispatch({
      effects: bracketColorsCompartment.reconfigure(bracketColors ? bracketColorsExtension() : []),
    });
  }, [view, bracketColors]);

  useEffect(() => {
    view?.dispatch({
      effects: cursorCompartment.reconfigure(cursorExtension(cursorStyle, cursorBlinking)),
    });
  }, [view, cursorStyle, cursorBlinking]);

  useEffect(() => {
    view?.dispatch({ effects: lineHeightCompartment.reconfigure(lineHeightExtension(lineHeight)) });
  }, [view, lineHeight]);

  useEffect(() => {
    view?.dispatch({
      effects: ligaturesCompartment.reconfigure(ligaturesExtension(fontLigatures)),
    });
  }, [view, fontLigatures]);

  useEffect(() => {
    view?.dispatch({
      effects: overviewCompartment.reconfigure(overviewMarkers ? overviewRulerExtension() : []),
    });
  }, [view, overviewMarkers]);
}
