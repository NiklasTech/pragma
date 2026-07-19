import type { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import { create } from "zustand";

import { useProblemsStore, type Problem } from "@/shared/stores/problems";
import { lspCodeAction, type LspCodeAction } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { coordsToPos, positionToLsp } from "./definition";
import { applyWorkspaceEdits } from "./workspaceEdits";

interface CodeActionsDialogState {
  open: boolean;
  actions: LspCodeAction[];
  openDialog: (actions: LspCodeAction[]) => void;
  closeDialog: () => void;
}

export const useCodeActionsStore = create<CodeActionsDialogState>()((set) => ({
  open: false,
  actions: [],
  openDialog: (actions) => set({ open: true, actions }),
  closeDialog: () => set({ open: false, actions: [] }),
}));

function problemToLspDiagnostic(problem: Problem): Record<string, unknown> {
  return {
    range: {
      start: { line: problem.line - 1, character: problem.column - 1 },
      end: {
        line: (problem.endLine ?? problem.line) - 1,
        character: (problem.endColumn ?? problem.column) - 1,
      },
    },
    severity: problem.severity === "error" ? 1 : problem.severity === "warning" ? 2 : 3,
    message: problem.message,
    source: problem.source,
  };
}

export async function requestCodeActionsAt(
  view: EditorView,
  language: string,
  filePath: string,
  pos: number,
): Promise<void> {
  const { line, character } = positionToLsp(view.state.doc, pos);
  const diagnostics = useProblemsStore
    .getState()
    .problems.filter(
      (p) => p.filePath === filePath && p.line - 1 <= line && (p.endLine ?? p.line) - 1 >= line,
    )
    .map(problemToLspDiagnostic);

  try {
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});
    const actions = await lspCodeAction(
      language,
      filePath,
      { start: { line, character }, end: { line, character } },
      diagnostics,
    );
    const applicable = actions.filter((action) => action.edits.length > 0);
    if (applicable.length === 0) {
      toast.info("No code actions available here");
      return;
    }
    useCodeActionsStore.getState().openDialog(applicable);
  } catch (error) {
    console.error("LSP code action request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

export function requestCodeActionsAtCoords(
  view: EditorView,
  language: string,
  filePath: string,
  clientX: number,
  clientY: number,
): void {
  const pos = coordsToPos(view, clientX, clientY);
  if (pos === null) {
    return;
  }
  void requestCodeActionsAt(view, language, filePath, pos);
}

export async function executeCodeAction(action: LspCodeAction): Promise<void> {
  try {
    await applyWorkspaceEdits(action.edits);
    toast.success(action.title);
  } catch (error) {
    console.error("LSP code action failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
  }
}
