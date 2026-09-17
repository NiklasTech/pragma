import { invoke } from "@tauri-apps/api/core";

import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import type { CappedAutoContext } from "@/shared/lib/chat-context";

import { assembleAutoContext } from "./autoContext";
import { getChatContextSources } from "./chatContextSettings";

interface GitDiffResult {
  diff_text: string;
  truncated: boolean;
}

const TERMINAL_LINE_LIMIT = 40;

let lastEditorSelection: string | null = null;
let selectionListenerAttached = false;

function currentEditorSelection(): string | null {
  if (typeof window === "undefined" || !window.getSelection) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const anchor = selection.anchorNode;
  const element = anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
  if (!element?.closest(".cm-content")) return null;

  const text = selection.toString();
  return text.trim().length > 0 ? text : null;
}

function attachSelectionListener(): void {
  if (selectionListenerAttached || typeof document === "undefined") return;
  selectionListenerAttached = true;
  document.addEventListener("selectionchange", () => {
    const selection = currentEditorSelection();
    if (selection) lastEditorSelection = selection;
  });
}

export function readEditorSelection(): string | null {
  attachSelectionListener();
  const current = currentEditorSelection();
  if (current) {
    lastEditorSelection = current;
    return current;
  }
  return lastEditorSelection;
}

attachSelectionListener();

export function readTerminalSnapshot(lineLimit = TERMINAL_LINE_LIMIT): string | null {
  if (typeof document === "undefined") return null;

  const roots = Array.from(document.querySelectorAll<HTMLElement>(".xterm-rows")).filter(
    (element) => element.offsetParent !== null,
  );
  const root = roots[roots.length - 1];
  if (!root) return null;

  const lines = Array.from(root.children)
    .map((row) => (row.textContent ?? "").replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);

  const tail = lines.slice(-lineLimit).join("\n");
  return tail.trim().length > 0 ? tail : null;
}

async function readWorkspaceDiff(repoPath: string): Promise<string | null> {
  try {
    const [unstaged, staged] = await Promise.all([
      invoke<GitDiffResult>("git_diff", { repoPath, path: null, staged: false }),
      invoke<GitDiffResult>("git_diff", { repoPath, path: null, staged: true }),
    ]);
    const combined = [unstaged.diff_text, staged.diff_text]
      .map((text) => text.trim())
      .filter(Boolean)
      .join("\n");
    return combined.length > 0 ? combined : null;
  } catch {
    return null;
  }
}

function activeFileTab(): FileTab | null {
  const editor = useEditorStore.getState();
  const tab = editor.tabs.find((candidate) => candidate.id === editor.activeTabId);
  return tab && tab.kind === "file" ? tab : null;
}

export async function collectLiveAutoContext(): Promise<CappedAutoContext> {
  const sources = getChatContextSources();
  const editor = useEditorStore.getState();
  const active = activeFileTab();
  const fileTabs = editor.tabs.filter((tab): tab is FileTab => tab.kind === "file");
  const rootPath = useFileExplorerStore.getState().rootPath;

  const gitDiff = sources.gitDiff
    ? await readWorkspaceDiff(useGitStore.getState().repoPath ?? rootPath ?? "")
    : null;

  return assembleAutoContext({
    rootPath,
    activeFile: active
      ? { path: active.path, content: active.content, selection: readEditorSelection() }
      : null,
    openTabs: fileTabs.map((tab) => ({
      path: tab.path,
      name: tab.name,
      content: tab.content,
    })),
    gitDiff,
    terminalOutput: sources.terminal ? readTerminalSnapshot() : null,
    sources,
  });
}
