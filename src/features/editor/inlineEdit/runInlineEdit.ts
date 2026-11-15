import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { EditorView } from "@codemirror/view";

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { findSpaceByFolder } from "@/shared/stores/spaces/model";
import { agentPane, quickAgents } from "@/features/ai/quickStart/quickStart";
import { startQuickTask } from "@/features/ai/quickStart/startQuickTask";

import { closeEdit, currentEdit, proposeInlineEdit } from "./inlineEdit";
import { useInlineEditStore } from "./inlineEditStore";
import { changeSummary, inlineEditModel } from "./inlineEditText";

const CONTEXT_CHARS = 6000;

/// Asks the active model to rewrite the lines under review and shows its answer as a diff.
export async function requestInlineEdit(view: EditorView, id: number): Promise<void> {
  const edit = currentEdit(view);
  const model = inlineEditModel(useAIStore.getState());
  const store = useInlineEditStore.getState();
  if (!edit || edit.id !== id || !model || !store.instruction.trim()) return;
  const doc = view.state.doc;
  const selection = doc.sliceString(edit.from, edit.to);
  store.setPhase(id, { kind: "working" });
  proposeInlineEdit(view, null);
  try {
    const replacement = await invoke<string>("ai_inline_edit", {
      req: {
        file_path: store.filePath,
        before: doc.sliceString(Math.max(0, edit.from - CONTEXT_CHARS), edit.from),
        selection,
        after: doc.sliceString(edit.to, Math.min(doc.length, edit.to + CONTEXT_CHARS)),
        instruction: store.instruction.trim(),
        provider: model.provider,
        model: model.model,
        base_url: model.baseUrl,
      },
    });
    if (currentEdit(view)?.id !== id) return;
    proposeInlineEdit(view, replacement);
    useInlineEditStore.getState().setPhase(id, {
      kind: "result",
      replacement,
      summary: changeSummary(selection, replacement),
    });
  } catch (error) {
    useInlineEditStore.getState().setPhase(id, { kind: "error", message: String(error) });
  }
}

/** The CLI that takes a task, the first one installed. */
export function taskAgent() {
  const { cliManifests, cliStatuses } = useAIStore.getState();
  return quickAgents(cliManifests, cliStatuses).ready[0] ?? null;
}

function relativePath(rootPath: string, path: string): string {
  return path.startsWith(`${rootPath}/`) ? path.slice(rootPath.length + 1) : path;
}

/// Hands the instruction to an agent as a task in a new agents tab, then brings the code back to the front.
export async function makeInlineEditTask(view: EditorView, id: number): Promise<void> {
  const edit = currentEdit(view);
  const agent = taskAgent();
  const rootPath = useFileExplorerStore.getState().rootPath;
  const store = useInlineEditStore.getState();
  if (!edit || edit.id !== id || !agent || !rootPath || !store.instruction.trim()) return;

  const doc = view.state.doc;
  const first = doc.lineAt(edit.from).number;
  const last = doc.lineAt(edit.to).number;
  const lines = first === last ? `line ${first}` : `lines ${first}-${last}`;
  const task = `In ${relativePath(rootPath, store.filePath)}, ${lines}: ${store.instruction.trim()}`;

  const space = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  const previousTab = space?.activeTabId ?? null;
  const knownTabs = new Set(space?.tabs.map((tab) => tab.id) ?? []);
  // Closed without focusing the editor, which would bring the code tab back while the agent starts.
  useInlineEditStore.getState().end(id);
  view.dispatch({ effects: closeEdit.of(null) });
  // The new tab comes to the front while its agent starts; the code returns once it runs.
  await startQuickTask({
    rootPath,
    task,
    layout: agentPane({ kind: "cli", manifestId: agent.id }),
    where: "here",
  });

  const after = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  const tabId = after?.tabs.find((tab) => !knownTabs.has(tab.id))?.id ?? null;
  if (after && previousTab) useOpenRepositoriesStore.getState().activateTab(after.id, previousTab);
  toast(`${agent.name} took it as a task`, {
    description: "It works in a new tab.",
    action: tabId ? { label: "Show", onClick: () => showTaskTab(tabId) } : undefined,
  });
}

export function showTaskTab(tabId: string): void {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) return;
  const space = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  if (space) useOpenRepositoriesStore.getState().activateTab(space.id, tabId);
}
