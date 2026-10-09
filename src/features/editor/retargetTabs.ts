import { isSameOrInside } from "@/shared/lib/fileDisk";
import { useEditorStore, type EditorTab } from "@/shared/stores/editor";

/// Where `path` ends up after `from` moved to `to`; null when it is not inside `from`.
export function movedPath(path: string, from: string, to: string): string | null {
  if (!isSameOrInside(path, from)) return null;
  return `${to}${path.slice(from.length)}`;
}

function renameKeys<T>(record: Record<string, T>, ids: Map<string, string>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([id, value]) => [ids.get(id) ?? id, value]),
  );
}

/// Points open file and preview tabs at the new location after a file or folder moved on disk.
export function retargetTabs(from: string, to: string): void {
  const ids = new Map<string, string>();
  const state = useEditorStore.getState();
  const tabs = state.tabs.map((tab): EditorTab => {
    if (tab.kind !== "file" && tab.kind !== "preview") return tab;
    const path = movedPath(tab.path, from, to);
    if (!path) return tab;
    // File tab ids are the path; preview tab ids are `preview:` plus the path.
    const id = tab.id.endsWith(tab.path) ? `${tab.id.slice(0, -tab.path.length)}${path}` : tab.id;
    if (id !== tab.id) ids.set(tab.id, id);
    const name = path.split(/[\\/]/).pop() ?? tab.name;
    return { ...tab, id, path, name };
  });
  if (tabs.every((tab, index) => tab === state.tabs[index])) return;

  const rename = (id: string | null) => (id ? (ids.get(id) ?? id) : id);
  useEditorStore.setState({
    tabs,
    tabStates: state.tabStates.map((s) => ({ ...s, tabId: ids.get(s.tabId) ?? s.tabId })),
    activeTabId: rename(state.activeTabId),
    activeTabIds: Object.fromEntries(
      Object.entries(state.activeTabIds).map(([panelId, id]) => [panelId, rename(id)]),
    ),
    cursorPositions: renameKeys(state.cursorPositions, ids),
    vimModes: renameKeys(state.vimModes, ids),
  });
}
