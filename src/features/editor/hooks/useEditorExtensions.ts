import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { lintGutter } from "@codemirror/lint";
import { EditorState, type Compartment, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { codeFolding, foldGutter, foldKeymap, indentUnit } from "@codemirror/language";
import { vim } from "@replit/codemirror-vim";
import {
  pragmaDarkTheme,
  themeCompartment,
  editorBaseTheme,
  createEditorFontStyleExtension,
} from "@/shared/lib/theme/editor-theme";
import { useDebugStore } from "@/features/debug/store";
import { breakpointGutter, getBreakpointLines } from "@/features/debug/breakpointGutter";
import { sameLines } from "@/features/debug/debugState";
import {
  ghostTextExtension,
  type GhostTextConfig,
} from "@/features/editor/components/extensions/ghost-text";
import { insertTabBinding } from "@/features/editor/components/extensions/tab-keymap";
import { searchExtension } from "@/features/editor/components/extensions/search";
import {
  languageCompartment,
  ghostTextCompartment,
  fontStyleCompartment,
  lineNumbersCompartment,
  wordWrapCompartment,
  tabSizeCompartment,
  indentUnitCompartment,
  blameCompartment,
  externalUpdate,
} from "@/features/editor/compartments";

export interface EditorExtensionsContext {
  diagnosticsCompartmentRef: RefObject<Compartment>;
  breakpointCompartmentRef: RefObject<Compartment>;
  lspCompletionCompartmentRef: RefObject<Compartment>;
  lspDefinitionCompartmentRef: RefObject<Compartment>;
  lspHoverCompartmentRef: RefObject<Compartment>;
  lspReferencesCompartmentRef: RefObject<Compartment>;
  lspRenameCompartmentRef: RefObject<Compartment>;
  lspSignatureHelpCompartmentRef: RefObject<Compartment>;
  lspDocumentSymbolsCompartmentRef: RefObject<Compartment>;
  lspInlayHintsCompartmentRef: RefObject<Compartment>;
  filePathRef: RefObject<string>;
  selectedTextRef: RefObject<string>;
  setHasSelection: Dispatch<SetStateAction<boolean>>;
  showLineNumbers: boolean;
  tabSize: number;
  insertSpaces: boolean;
  fontSize: number;
  editorFontFamily: string;
  wordWrap: boolean;
}

export type CreateEditorExtensions = (
  onChangeValue: (value: string) => void,
  onCursorChange: (pos: { line: number; column: number }) => void,
  enableVim: boolean,
  ghostConfig: GhostTextConfig,
) => Extension[];

export function useEditorExtensions({
  diagnosticsCompartmentRef,
  breakpointCompartmentRef,
  lspCompletionCompartmentRef,
  lspDefinitionCompartmentRef,
  lspHoverCompartmentRef,
  lspReferencesCompartmentRef,
  lspRenameCompartmentRef,
  lspSignatureHelpCompartmentRef,
  lspDocumentSymbolsCompartmentRef,
  lspInlayHintsCompartmentRef,
  filePathRef,
  selectedTextRef,
  setHasSelection,
  showLineNumbers,
  tabSize,
  insertSpaces,
  fontSize,
  editorFontFamily,
  wordWrap,
}: EditorExtensionsContext): CreateEditorExtensions {
  return useCallback(
    (
      onChangeValue: (value: string) => void,
      onCursorChange: (pos: { line: number; column: number }) => void,
      enableVim: boolean,
      ghostConfig: GhostTextConfig,
    ): Extension[] => {
      const extensions: Extension[] = [
        languageCompartment.of([]),
        themeCompartment.of(pragmaDarkTheme),
        diagnosticsCompartmentRef.current.of([]),
        lspCompletionCompartmentRef.current.of([]),
        lspDefinitionCompartmentRef.current.of([]),
        lspHoverCompartmentRef.current.of([]),
        lspReferencesCompartmentRef.current.of([]),
        lspRenameCompartmentRef.current.of([]),
        lspSignatureHelpCompartmentRef.current.of([]),
        lspDocumentSymbolsCompartmentRef.current.of([]),
        lspInlayHintsCompartmentRef.current.of([]),
        breakpointCompartmentRef.current.of(
          breakpointGutter((line) => {
            useDebugStore.getState().toggleBreakpoint(filePathRef.current, line);
          }),
        ),
        lintGutter(),
        lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
        blameCompartment.of([]),
        history(),
        ghostTextCompartment.of(ghostTextExtension(ghostConfig)),
        keymap.of([...defaultKeymap, ...historyKeymap, insertTabBinding, ...foldKeymap]),
        searchExtension(),
        codeFolding(),
        foldGutter(),
        drawSelection(),
        editorBaseTheme,
        fontStyleCompartment.of(createEditorFontStyleExtension(fontSize, editorFontFamily)),
        wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const isExternal = update.transactions.some((tr) =>
              tr.effects.some((e) => e.is(externalUpdate)),
            );
            if (!isExternal) {
              onChangeValue(update.state.doc.toString());
            }
            const debugStore = useDebugStore.getState();
            const breakpointLines = getBreakpointLines(update.state);
            if (!sameLines(breakpointLines, debugStore.breakpoints[filePathRef.current] ?? [])) {
              debugStore.syncFileBreakpoints(filePathRef.current, breakpointLines);
            }
          }
          if (update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursorChange({ line: line.number, column: head - line.from + 1 });

            const { from, to } = update.state.selection.main;
            const selected = from !== to;
            setHasSelection(selected);
            selectedTextRef.current = selected ? update.state.doc.sliceString(from, to) : "";
          }
        }),
        tabSizeCompartment.of(EditorState.tabSize.of(tabSize)),
        EditorState.allowMultipleSelections.of(true),
        indentUnitCompartment.of(indentUnit.of(insertSpaces ? " ".repeat(tabSize) : "\t")),
      ];

      if (enableVim) {
        extensions.unshift(vim({ status: false }));
      }

      return extensions;
    },
    [tabSize, insertSpaces, fontSize, editorFontFamily, wordWrap, showLineNumbers],
  );
}
