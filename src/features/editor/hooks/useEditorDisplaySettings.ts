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
  paddingCompartment,
  rulersCompartment,
  scrollPastEndCompartment,
  textStyleCompartment,
  activeLineCompartment,
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
import {
  activeLineExtension,
  paddingExtension,
  scrollPastEndExtension,
  textStyleExtension,
} from "@/features/editor/components/extensions/text-display";
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
  const fontWeight = useSettingsStore((state) => state.editor.fontWeight);
  const letterSpacing = useSettingsStore((state) => state.editor.letterSpacing);
  const padding = useSettingsStore((state) => state.editor.padding);
  const highlightActive = useSettingsStore((state) => state.editor.highlightActiveLine);
  const pastEnd = useSettingsStore((state) => state.editor.scrollPastEnd);

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

  useEffect(() => {
    view?.dispatch({
      effects: textStyleCompartment.reconfigure(textStyleExtension(fontWeight, letterSpacing)),
    });
  }, [view, fontWeight, letterSpacing]);

  useEffect(() => {
    view?.dispatch({ effects: paddingCompartment.reconfigure(paddingExtension(padding)) });
  }, [view, padding]);

  useEffect(() => {
    view?.dispatch({
      effects: activeLineCompartment.reconfigure(activeLineExtension(highlightActive)),
    });
  }, [view, highlightActive]);

  useEffect(() => {
    view?.dispatch({
      effects: scrollPastEndCompartment.reconfigure(scrollPastEndExtension(pastEnd)),
    });
  }, [view, pastEnd]);
}
