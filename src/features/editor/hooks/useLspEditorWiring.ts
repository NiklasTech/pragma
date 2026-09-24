import { useEffect } from "react";
import type { RefObject } from "react";
import type { Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { lspServerCapabilities } from "@/features/editor/lsp/client";
import { lspCompletionExtension } from "@/features/editor/lsp/completion";
import {
  goToDefinitionAtCoords,
  hasDefinitionAtCoords,
  lspDefinitionExtension,
} from "@/features/editor/lsp/definition";
import { lspHoverExtension } from "@/features/editor/lsp/hover";
import { formatDocumentInView } from "@/features/editor/lsp/formatting";
import { lspReferencesExtension, findReferencesAtCoords } from "@/features/editor/lsp/references";
import { lspRenameExtension, requestRenameAtCoords } from "@/features/editor/lsp/rename";
import { requestCodeActionsAtCoords } from "@/features/editor/lsp/codeActions";
import {
  lspDocumentSymbolsExtension,
  openDocumentSymbolsForView,
} from "@/features/editor/lsp/symbols";
import { signatureHelpExtension } from "@/features/editor/lsp/signatureHelp";
import { lspInlayHintsExtension } from "@/features/editor/lsp/inlayHints";
import { setLspFeatureFlags } from "@/features/editor/lsp/lspFlags";
import { useEditorStore } from "@/shared/stores/editor";
import {
  EDITOR_CHECK_DEFINITION_EVENT,
  EDITOR_CODE_ACTION_EVENT,
  EDITOR_DOCUMENT_SYMBOLS_EVENT,
  EDITOR_FIND_REFERENCES_EVENT,
  EDITOR_FORMAT_DOCUMENT_EVENT,
  EDITOR_GO_TO_DEFINITION_EVENT,
  EDITOR_RENAME_EVENT,
  dispatchEditorDefinitionAvailability,
  type EditorCheckDefinitionEventDetail,
  type EditorFindReferencesEventDetail,
  type EditorGoToDefinitionEventDetail,
} from "@/shared/lib/editor-events";

interface LspEditorWiringContext {
  viewRef: RefObject<EditorView | null>;
  language: string | undefined;
  filePath: string;
  experimentalLsp: boolean;
  lspEnabledForLanguage: boolean;
  inlayHintsEnabled: boolean;
  tabId: string;
  lspCompletionCompartmentRef: RefObject<Compartment>;
  lspDefinitionCompartmentRef: RefObject<Compartment>;
  lspHoverCompartmentRef: RefObject<Compartment>;
  lspReferencesCompartmentRef: RefObject<Compartment>;
  lspRenameCompartmentRef: RefObject<Compartment>;
  lspSignatureHelpCompartmentRef: RefObject<Compartment>;
  lspDocumentSymbolsCompartmentRef: RefObject<Compartment>;
  lspInlayHintsCompartmentRef: RefObject<Compartment>;
}

export function useLspEditorWiring({
  viewRef,
  language,
  filePath,
  experimentalLsp,
  lspEnabledForLanguage,
  inlayHintsEnabled,
  tabId,
  lspCompletionCompartmentRef,
  lspDefinitionCompartmentRef,
  lspHoverCompartmentRef,
  lspReferencesCompartmentRef,
  lspRenameCompartmentRef,
  lspSignatureHelpCompartmentRef,
  lspDocumentSymbolsCompartmentRef,
  lspInlayHintsCompartmentRef,
}: LspEditorWiringContext): void {
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        lspCompletionCompartmentRef.current.reconfigure([]),
        lspHoverCompartmentRef.current.reconfigure([]),
        lspSignatureHelpCompartmentRef.current.reconfigure([]),
        lspInlayHintsCompartmentRef.current.reconfigure([]),
      ],
    });

    if (!experimentalLsp || !lspEnabledForLanguage || !language || !isLspSupported(language)) {
      return;
    }

    const resolvedLanguage = language;
    let cancelled = false;

    void lspServerCapabilities(resolvedLanguage, filePath)
      .then((flags) => {
        if (cancelled || !viewRef.current) return;
        setLspFeatureFlags(filePath, flags);
        const extension = flags.completion
          ? lspCompletionExtension(resolvedLanguage, filePath, flags)
          : [];
        const hoverExtension = flags.hover ? lspHoverExtension(resolvedLanguage, filePath) : [];
        const signatureHelp = flags.signatureHelp
          ? signatureHelpExtension(resolvedLanguage, filePath, flags.signatureHelpTriggerCharacters)
          : [];
        const inlayHints =
          flags.inlayHint && inlayHintsEnabled
            ? lspInlayHintsExtension(resolvedLanguage, filePath)
            : [];
        viewRef.current.dispatch({
          effects: [
            lspCompletionCompartmentRef.current.reconfigure(extension),
            lspHoverCompartmentRef.current.reconfigure(hoverExtension),
            lspSignatureHelpCompartmentRef.current.reconfigure(signatureHelp),
            lspInlayHintsCompartmentRef.current.reconfigure(inlayHints),
          ],
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage, inlayHintsEnabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const enabled =
      experimentalLsp && lspEnabledForLanguage && language && isLspSupported(language);
    view.dispatch({
      effects: [
        lspDefinitionCompartmentRef.current.reconfigure(
          enabled ? lspDefinitionExtension(language, filePath) : [],
        ),
        lspReferencesCompartmentRef.current.reconfigure(
          enabled ? lspReferencesExtension(language, filePath) : [],
        ),
        lspRenameCompartmentRef.current.reconfigure(
          enabled ? lspRenameExtension(language, filePath) : [],
        ),
        lspDocumentSymbolsCompartmentRef.current.reconfigure(
          enabled ? lspDocumentSymbolsExtension(language, filePath) : [],
        ),
      ],
    });
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage]);

  useEffect(() => {
    if (!language) return;

    const lspActive = () => experimentalLsp && lspEnabledForLanguage && isLspSupported(language);

    const onGoToDefinition = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorGoToDefinitionEventDetail>).detail;
      goToDefinitionAtCoords(view, language, filePath, clientX, clientY);
    };

    const onFindReferences = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      findReferencesAtCoords(view, language, filePath, clientX, clientY);
    };

    const onRename = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      requestRenameAtCoords(view, language, filePath, clientX, clientY);
    };

    const onCodeAction = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      requestCodeActionsAtCoords(view, language, filePath, clientX, clientY);
    };

    const onDocumentSymbols = () => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      void openDocumentSymbolsForView(view, language, filePath);
    };

    const onFormatDocument = () => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      void formatDocumentInView(view, language, filePath);
    };

    const onCheckDefinition = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY, requestId } = (
        event as CustomEvent<EditorCheckDefinitionEventDetail>
      ).detail;
      void hasDefinitionAtCoords(view, language, filePath, clientX, clientY).then((available) => {
        if (available !== null) {
          dispatchEditorDefinitionAvailability({ requestId, available });
        }
      });
    };

    window.addEventListener(EDITOR_GO_TO_DEFINITION_EVENT, onGoToDefinition);
    window.addEventListener(EDITOR_CHECK_DEFINITION_EVENT, onCheckDefinition);
    window.addEventListener(EDITOR_FORMAT_DOCUMENT_EVENT, onFormatDocument);
    window.addEventListener(EDITOR_FIND_REFERENCES_EVENT, onFindReferences);
    window.addEventListener(EDITOR_RENAME_EVENT, onRename);
    window.addEventListener(EDITOR_CODE_ACTION_EVENT, onCodeAction);
    window.addEventListener(EDITOR_DOCUMENT_SYMBOLS_EVENT, onDocumentSymbols);
    return () => {
      window.removeEventListener(EDITOR_GO_TO_DEFINITION_EVENT, onGoToDefinition);
      window.removeEventListener(EDITOR_CHECK_DEFINITION_EVENT, onCheckDefinition);
      window.removeEventListener(EDITOR_FORMAT_DOCUMENT_EVENT, onFormatDocument);
      window.removeEventListener(EDITOR_FIND_REFERENCES_EVENT, onFindReferences);
      window.removeEventListener(EDITOR_RENAME_EVENT, onRename);
      window.removeEventListener(EDITOR_CODE_ACTION_EVENT, onCodeAction);
      window.removeEventListener(EDITOR_DOCUMENT_SYMBOLS_EVENT, onDocumentSymbols);
    };
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage]);
}
