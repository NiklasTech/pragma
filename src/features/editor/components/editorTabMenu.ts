import type { ActionMenuSpec } from "@/shared/components/ui/action-menu";
import type { EditorTab } from "@/shared/stores/editor";

export interface EditorTabActions {
  close: (tabId: string) => void;
  closeShortcut?: string;
  showHistory: (path: string) => void;
  copyPath: (path: string) => void;
  /** The open folder, so the header shows the path inside it. */
  rootPath: string | null;
}

function shownPath(path: string, rootPath: string | null): string {
  if (!rootPath) return path;
  const prefix = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/// Right-click on an editor tab: close it or its neighbours, its file's history, its path.
export function editorTabMenu(
  tab: EditorTab,
  tabs: readonly EditorTab[],
  actions: EditorTabActions,
): ActionMenuSpec {
  const index = tabs.findIndex((item) => item.id === tab.id);
  const others = tabs.filter((item) => item.id !== tab.id);
  const toTheRight = tabs.slice(index + 1);
  const isFile = tab.kind === "file" && tab.path !== "";
  return {
    head: isFile ? shownPath(tab.path, actions.rootPath) : tab.name,
    tone: tab.kind === "file" && tab.isModified ? "needs-you" : "idle",
    groups: [
      {
        items: [
          {
            key: "w",
            label: "close",
            shortcut: actions.closeShortcut,
            onSelect: () => actions.close(tab.id),
          },
          {
            key: "o",
            label: "close others",
            disabled: others.length === 0,
            onSelect: () => others.forEach((item) => actions.close(item.id)),
          },
          {
            key: "l",
            label: "close to the right",
            disabled: toTheRight.length === 0,
            onSelect: () => toTheRight.forEach((item) => actions.close(item.id)),
          },
          {
            key: "a",
            label: "close all",
            onSelect: () => tabs.forEach((item) => actions.close(item.id)),
          },
        ],
      },
      {
        items: isFile
          ? [
              { key: "h", label: "file history", onSelect: () => actions.showHistory(tab.path) },
              { key: "c", label: "copy path", onSelect: () => actions.copyPath(tab.path) },
            ]
          : [],
      },
    ],
  };
}
