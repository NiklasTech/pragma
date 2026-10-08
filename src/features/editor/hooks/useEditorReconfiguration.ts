import { useEffect } from "react";
import type { RefObject } from "react";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import {
  pragmaDarkTheme,
  themeCompartment,
  createEditorFontStyleExtension,
} from "@/shared/lib/theme/editor-theme";
import {
  setBreakpointMarkersEffect,
  getBreakpointMarkers,
} from "@/features/debug/breakpointGutter";
import {
  sameMarkerSpecs,
  toMarkerSpecs,
  type FileBreakpointSettings,
} from "@/features/debug/breakpointSettings";
import {
  fontStyleCompartment,
  lineNumbersCompartment,
  wordWrapCompartment,
  tabSizeCompartment,
  indentUnitCompartment,
} from "@/features/editor/compartments";

interface EditorReconfigurationContext {
  viewRef: RefObject<EditorView | null>;
  themeId: string;
  resolvedMode: "dark" | "light";
  fontSize: number;
  editorFontFamily: string;
  showLineNumbers: boolean;
  fileBreakpoints: number[] | undefined;
  fileBreakpointSettings: FileBreakpointSettings | undefined;
  filePath: string;
  wordWrap: boolean;
  tabSize: number;
  insertSpaces: boolean;
}

export function useEditorReconfiguration({
  viewRef,
  themeId,
  resolvedMode,
  fontSize,
  editorFontFamily,
  showLineNumbers,
  fileBreakpoints,
  fileBreakpointSettings,
  filePath,
  wordWrap,
  tabSize,
  insertSpaces,
}: EditorReconfigurationContext): void {
  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(pragmaDarkTheme),
    });
  }, [themeId, resolvedMode]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: fontStyleCompartment.reconfigure(
        createEditorFontStyleExtension(fontSize, editorFontFamily),
      ),
    });
  }, [fontSize, editorFontFamily]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
    });
  }, [showLineNumbers]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const markers = toMarkerSpecs(fileBreakpoints ?? [], fileBreakpointSettings);
    if (sameMarkerSpecs(getBreakpointMarkers(view.state), markers)) return;
    view.dispatch({ effects: setBreakpointMarkersEffect.of(markers) });
  }, [fileBreakpoints, fileBreakpointSettings, filePath]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: [
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(tabSize)),
        indentUnitCompartment.reconfigure(indentUnit.of(insertSpaces ? " ".repeat(tabSize) : "\t")),
      ],
    });
  }, [tabSize, insertSpaces]);
}
