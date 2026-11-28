import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { readNumberInput, readStringInput, resolveWorkspacePath } from "@/features/agent/toolInput";
import { parseDiffToSides } from "@/shared/lib/diff";
import { useAIStore } from "@/shared/stores/ai";
import { useEditorStore } from "@/shared/stores/editor";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useUiModeStore } from "@/shell/mode/store";

import { openWorkspaceFile } from "../components/openWorkspaceFile";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const MAX_SELECTION_CHARS = 20_000;

function sessionTitle(sessionId: string): string {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  return session?.title || "An agent";
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/// Offers the editor instead of switching to it, so the user is not pulled out of their work.
function offerEditor(message: string): void {
  toast(message, {
    action: { label: "Show", onClick: () => useUiModeStore.getState().setUiMode("editor") },
  });
}

function requiredPath(args: unknown, context: PragmaToolContext): string {
  const path = readStringInput(args, "path").trim();
  if (!path) throw new Error("path is required");
  return resolveWorkspacePath(context.cwd, path);
}

/** The path relative to the working folder, which git commands take. */
export function relativeTo(cwd: string, absolute: string): string {
  const root = cwd.replace(/[\\/]+$/, "");
  if (absolute === root || !absolute.startsWith(root)) {
    throw new Error(`${absolute} is outside the session's working folder ${root}`);
  }
  const rest = absolute.slice(root.length);
  if (!/^[\\/]/.test(rest)) throw new Error(`${absolute} is outside the session's working folder`);
  return rest.replace(/^[\\/]+/, "");
}

async function openFile(args: unknown, context: PragmaToolContext): Promise<string> {
  const path = requiredPath(args, context);
  if (!(await openWorkspaceFile(path, null))) throw new Error(`Pragma could not open ${path}`);
  const line = readNumberInput(args, "line");
  const editor = useEditorStore.getState();
  if (line !== undefined && line >= 1 && editor.activeTabId) {
    editor.goToPosition(editor.activeTabId, { line: Math.floor(line), column: 1 });
  }
  const at = line !== undefined ? ` at line ${Math.floor(line)}` : "";
  offerEditor(`${sessionTitle(context.sessionId)} opened ${fileName(path)}${at}`);
  return `Opened ${path}${at} in Pragma's editor.`;
}

async function gitDiff(repoPath: string, path: string, staged: boolean): Promise<string> {
  const { diff_text: text } = await invoke<{ diff_text: string }>("git_diff", {
    repoPath,
    path,
    staged,
  });
  return text && text !== "No diff available" ? text : "";
}

async function showDiff(args: unknown, context: PragmaToolContext): Promise<string> {
  const path = relativeTo(context.cwd, requiredPath(args, context));
  let staged = false;
  let patchText = await gitDiff(context.cwd, path, staged);
  if (!patchText) {
    staged = true;
    patchText = await gitDiff(context.cwd, path, staged);
  }
  if (!patchText) return `${path} has no uncommitted changes.`;
  const { original, modified } = parseDiffToSides(patchText);
  useEditorStore.getState().openDiff({
    id: `diff:${context.cwd}:${path}:${staged ? "staged" : "unstaged"}`,
    path,
    original,
    modified,
    patchText,
    staged,
    repoPath: context.cwd,
  });
  offerEditor(`${sessionTitle(context.sessionId)} shows the changes of ${fileName(path)}`);
  return `Showing the ${staged ? "staged" : "uncommitted"} changes of ${path} in Pragma's editor.`;
}

async function openFiles(): Promise<string> {
  const { tabs, activeTabId } = useEditorStore.getState();
  const files = tabs.flatMap((tab) =>
    tab.kind === "file"
      ? [
          `${tab.path}${tab.isModified ? " (unsaved changes)" : ""}${tab.id === activeTabId ? " (active)" : ""}`,
        ]
      : [],
  );
  return files.length > 0 ? files.join("\n") : "No files are open in Pragma's editor.";
}

function viewOf(path: string): EditorView | null {
  for (const element of document.querySelectorAll<HTMLElement>("[data-file-path]")) {
    if (element.dataset.filePath !== path) continue;
    const editor = element.querySelector<HTMLElement>(".cm-editor");
    const view = editor ? EditorView.findFromDOM(editor) : null;
    if (view) return view;
  }
  return null;
}

async function selection(): Promise<string> {
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((item) => item.id === activeTabId);
  if (tab?.kind !== "file") return "No file is active in Pragma's editor.";
  const view = viewOf(tab.path);
  if (!view) return `${tab.path} is active, but its editor is not shown.`;
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const start = doc.lineAt(from);
  if (from === to) {
    return `Nothing is selected. The cursor is at ${tab.path}:${start.number}:${from - start.from + 1}.`;
  }
  const end = doc.lineAt(to);
  const text = doc.sliceString(from, Math.min(to, from + MAX_SELECTION_CHARS));
  const cut = to - from > MAX_SELECTION_CHARS ? "\n... [selection cut]" : "";
  return `${tab.path}, lines ${start.number} to ${end.number}:\n${text}${cut}`;
}

async function requestReview(args: unknown, context: PragmaToolContext): Promise<string> {
  const note = readStringInput(args, "message").trim();
  toast(`${sessionTitle(context.sessionId)} asks you to review its changes`, {
    description: note || undefined,
    duration: Infinity,
    action: {
      label: "Review",
      onClick: () => useOverlayStore.getState().open("review", context.sessionId),
    },
  });
  return "The user was asked to review the changes in Pragma's review view. Their comments come back as a new message.";
}

export const EDITOR_TOOLS: Record<string, PragmaToolHandler> = {
  editor_open: openFile,
  editor_show_diff: showDiff,
  editor_open_files: openFiles,
  editor_selection: selection,
  review_request: requestReview,
};
