import { useEffect } from "react";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import type { AIProvider, ProviderConfig } from "@/shared/stores/ai";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { ghostTextExtension } from "@/features/editor/components/extensions/ghost-text";
import { languageCompartment, ghostTextCompartment } from "@/features/editor/compartments";

interface EditorLanguageSyncContext {
  viewRef: RefObject<EditorView | null>;
  fileName: string;
  canComplete: boolean;
  completionDebounce: number;
  completionTriggerCharacters: string[];
  filePath: string;
  activeProvider: AIProvider;
  activeModel: string;
  providerConfig: ProviderConfig;
}

export function useEditorLanguageSync({
  viewRef,
  fileName,
  canComplete,
  completionDebounce,
  completionTriggerCharacters,
  filePath,
  activeProvider,
  activeModel,
  providerConfig,
}: EditorLanguageSyncContext): void {
  useEffect(() => {
    if (!viewRef.current) return;

    let cancelled = false;
    loadLanguage(fileName)
      .then((ext) => {
        if (cancelled || !viewRef.current) return;
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(ext),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: ghostTextCompartment.reconfigure(
        ghostTextExtension({
          enabled: canComplete,
          debounceMs: completionDebounce,
          triggerCharacters: completionTriggerCharacters,
          filePath,
          provider: activeProvider,
          model: activeModel,
          baseUrl: providerConfig.baseUrl,
        }),
      ),
    });
  }, [
    canComplete,
    completionDebounce,
    completionTriggerCharacters,
    filePath,
    activeProvider,
    activeModel,
    providerConfig.baseUrl,
  ]);
}
