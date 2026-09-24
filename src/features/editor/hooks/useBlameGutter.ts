import { useEffect } from "react";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { useEditorStore } from "@/shared/stores/editor";
import { useGitStore, type GitBlameLine } from "@/shared/stores/git";
import { blameGutterExtension, openBlameCommit } from "@/features/sidebar/components/blameGutter";
import { blameCompartment } from "@/features/editor/compartments";

interface BlameGutterContext {
  viewRef: RefObject<EditorView | null>;
  blameEnabled: boolean;
  blamePath: string | null;
  blameLines: GitBlameLine[];
  filePath: string;
  tabId: string;
}

export function useBlameGutter({
  viewRef,
  blameEnabled,
  blamePath,
  blameLines,
  filePath,
  tabId,
}: BlameGutterContext): void {
  useEffect(() => {
    if (!blameEnabled) return;
    if (useEditorStore.getState().activeTabId !== tabId) return;
    if (useGitStore.getState().blamePath === filePath) return;
    void useGitStore.getState().loadBlame(filePath);
  }, [blameEnabled, filePath, tabId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const active = blameEnabled && blamePath === filePath && blameLines.length > 0;
    view.dispatch({
      effects: blameCompartment.reconfigure(
        active ? blameGutterExtension(blameLines, openBlameCommit) : [],
      ),
    });
  }, [blameEnabled, blamePath, blameLines, filePath]);
}
