import { useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import { agentIdentity } from "@/shared/lib/agentIdentity";
import { useAIStore } from "@/shared/stores/ai";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { agentWorktreeFor } from "@/features/editor/agentWorktree";
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

async function loadBaseline(view: EditorView, repoPath: string, filePath: string): Promise<void> {
  const content = await invoke<string | null>("git_index_content", {
    repoPath,
    path: filePath,
  }).catch(() => null);
  view.dispatch({ effects: setGitBaseline.of(content) });
}

/** Stages a hunk; a file in an agent's worktree is staged in that worktree. */
async function stageFromEditor(
  view: EditorView,
  filePath: string,
  tabId: string,
  selection: GitLineSelection,
  worktreePath: string | null,
): Promise<void> {
  const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
  if (tab?.kind === "file" && tab.isModified) {
    toast.info("Save the file before staging a hunk");
    return;
  }
  if (worktreePath) {
    try {
      await invoke("git_apply_lines", {
        repoPath: worktreePath,
        path: filePath,
        action: "stage",
        selection,
      });
      await loadBaseline(view, worktreePath, filePath);
    } catch (err) {
      toast.error(String(err) || "Staging the hunk failed");
    }
    return;
  }
  const ok = await useGitStore.getState().applyLines(filePath, "stage", selection);
  if (!ok) toast.error(useGitStore.getState().error ?? "Staging the hunk failed");
}

/** Shows lines changed against the git index in the editor gutter. */
export function useGitChangeGutter({ view, filePath, tabId }: GitChangeGutterContext): void {
  const openRepoPath = useGitStore((state) => state.repoPath);
  const snapshot = useGitStore((state) => state.snapshot);
  const markAgentLines = useSettingsStore((state) => state.editor.markAgentLines);
  const environments = useAIStore((state) => state.workEnvironments);
  const sessions = useAIStore((state) => state.chatSessions);
  const worktree = useMemo(
    () => agentWorktreeFor(filePath, environments, sessions),
    [filePath, environments, sessions],
  );
  // A file in an agent's worktree is compared against that worktree, not the open repository.
  const worktreePath = worktree?.path ?? null;
  const repoPath = worktreePath ?? openRepoPath;
  const agentColor = markAgentLines && worktree ? agentIdentity(worktree.agentId, "").color : null;

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: gitChangeCompartment.reconfigure(
        repoPath
          ? gitChangeGutter(
              {
                stage: (selection) =>
                  void stageFromEditor(view, filePath, tabId, selection, worktreePath),
              },
              agentColor,
            )
          : [],
      ),
    });
  }, [view, repoPath, filePath, tabId, agentColor, worktreePath]);

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
