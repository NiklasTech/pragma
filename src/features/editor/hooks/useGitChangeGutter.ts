import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";
import { useGitStore, type GitLineSelection } from "@/shared/stores/git";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { gitChangeCompartment } from "@/features/editor/compartments";
import {
  focusedGitChangeView,
  gitChangeGutter,
  goToNextChange,
  goToPreviousChange,
  setGitBaseline,
} from "@/features/editor/components/extensions/git-change-gutter";

interface GitChangeGutterContext {
  view: EditorView | null;
  filePath: string;
  tabId: string;
}

async function stageFromEditor(
  filePath: string,
  tabId: string,
  selection: GitLineSelection,
): Promise<void> {
  const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
  if (tab?.kind === "file" && tab.isModified) {
    toast.info("Save the file before staging a hunk");
    return;
  }
  const ok = await useGitStore.getState().applyLines(filePath, "stage", selection);
  if (!ok) toast.error(useGitStore.getState().error ?? "Staging the hunk failed");
}

/** Shows lines changed against the git index in the editor gutter. */
export function useGitChangeGutter({ view, filePath, tabId }: GitChangeGutterContext): void {
  const repoPath = useGitStore((state) => state.repoPath);
  const snapshot = useGitStore((state) => state.snapshot);

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: gitChangeCompartment.reconfigure(
        repoPath
          ? gitChangeGutter({
              stage: (selection) => void stageFromEditor(filePath, tabId, selection),
            })
          : [],
      ),
    });
  }, [view, repoPath, filePath, tabId]);

  useEffect(() => {
    if (!view || !repoPath) return;
    let cancelled = false;
    void invoke<string | null>("git_index_content", { repoPath, path: filePath })
      .catch(() => null)
      .then((content) => {
        if (!cancelled) view.dispatch({ effects: setGitBaseline.of(content) });
      });
    return () => {
      cancelled = true;
    };
  }, [view, repoPath, filePath, snapshot]);
}

const palette = useCommandPaletteStore.getState();
palette.registerCommand({
  id: "git.nextChange",
  label: "Git: Go to Next Change",
  category: "Git",
  keywords: ["diff", "hunk", "gutter"],
  action: () => {
    const view = focusedGitChangeView();
    if (view && goToNextChange(view)) view.focus();
  },
});
palette.registerCommand({
  id: "git.previousChange",
  label: "Git: Go to Previous Change",
  category: "Git",
  keywords: ["diff", "hunk", "gutter"],
  action: () => {
    const view = focusedGitChangeView();
    if (view && goToPreviousChange(view)) view.focus();
  },
});
