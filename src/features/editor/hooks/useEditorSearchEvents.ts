import { useEffect } from "react";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { useEditorStore } from "@/shared/stores/editor";
import { openEditorSearchPanel } from "@/features/editor/components/extensions/search";
import { EDITOR_FIND_EVENT, EDITOR_REPLACE_EVENT } from "@/shared/lib/editor-events";

interface EditorSearchEventsContext {
  viewRef: RefObject<EditorView | null>;
  tabId: string;
}

export function useEditorSearchEvents({ viewRef, tabId }: EditorSearchEventsContext): void {
  useEffect(() => {
    const onFind = () => {
      const view = viewRef.current;
      if (!view) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      openEditorSearchPanel(view, "find");
    };

    const onReplace = () => {
      const view = viewRef.current;
      if (!view) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      openEditorSearchPanel(view, "replace");
    };

    window.addEventListener(EDITOR_FIND_EVENT, onFind);
    window.addEventListener(EDITOR_REPLACE_EVENT, onReplace);
    return () => {
      window.removeEventListener(EDITOR_FIND_EVENT, onFind);
      window.removeEventListener(EDITOR_REPLACE_EVENT, onReplace);
    };
  }, [tabId]);
}
