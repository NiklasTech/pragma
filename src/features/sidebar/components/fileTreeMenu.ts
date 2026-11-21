import type { ActionMenuSpec } from "@/shared/components/ui/action-menu";
import { getIsMac } from "@/shared/lib/shortcuts";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";

export interface FileTreeMenuActions {
  open: () => void;
  create: (isDirectory: boolean) => void;
  rename: () => void;
  remove: () => void;
  showLocalHistory: () => void;
  showFileHistory: (path: string) => void;
  addToChat: (paths: string[]) => void;
  copyPaths: (paths: string[], relative: boolean) => void;
  reveal: (path: string) => void;
  openInTerminal: (path: string, isDirectory: boolean) => void;
  duplicate: (path: string) => void;
}

function revealLabel(): string {
  if (getIsMac()) return "reveal in finder";
  return typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
    ? "reveal in explorer"
    : "reveal in file manager";
}

function shownPath(path: string, rootPath: string | null): string {
  if (!rootPath) return path;
  const prefix = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/// Right-click in the file tree: one file or folder, or every selected item at once.
export function fileTreeMenu(
  node: FileSystemNode,
  targets: string[],
  rootPath: string | null,
  actions: FileTreeMenuActions,
): ActionMenuSpec {
  if (targets.length > 1) {
    return {
      head: `${targets.length} items selected`,
      tone: "idle",
      groups: [
        {
          items: [
            {
              key: "a",
              label: `add ${targets.length} items to chat`,
              shortcut: "@",
              onSelect: () => actions.addToChat(targets),
            },
          ],
        },
        {
          items: [
            { key: "c", label: "copy paths", onSelect: () => actions.copyPaths(targets, false) },
            {
              key: "l",
              label: "copy relative paths",
              onSelect: () => actions.copyPaths(targets, true),
            },
          ],
        },
        {
          items: [
            {
              key: "x",
              label: `delete ${targets.length} items`,
              danger: true,
              onSelect: actions.remove,
            },
          ],
        },
      ],
    };
  }

  const editable = !node.repositoryRoot;
  return {
    head: shownPath(node.path, rootPath) || node.name,
    tone: node.isDirectory ? "idle" : "info",
    groups: [
      {
        items: [
          ...(node.isDirectory
            ? [
                { key: "n", label: "new file here", onSelect: () => actions.create(false) },
                { key: "f", label: "new folder here", onSelect: () => actions.create(true) },
              ]
            : [{ key: "o", label: "open", shortcut: "⏎", onSelect: actions.open }]),
          {
            key: "a",
            label: "add to chat",
            shortcut: "@",
            onSelect: () => actions.addToChat([node.path]),
          },
          ...(node.isDirectory
            ? []
            : [
                {
                  key: "h",
                  label: "file history",
                  onSelect: () => actions.showFileHistory(node.path),
                },
                { key: "y", label: "local history", onSelect: actions.showLocalHistory },
              ]),
        ],
      },
      {
        items: [
          { key: "c", label: "copy path", onSelect: () => actions.copyPaths([node.path], false) },
          {
            key: "l",
            label: "copy relative path",
            onSelect: () => actions.copyPaths([node.path], true),
          },
          { key: "e", label: revealLabel(), onSelect: () => actions.reveal(node.path) },
          {
            key: "t",
            label: "open in terminal",
            onSelect: () => actions.openInTerminal(node.path, node.isDirectory),
          },
        ],
      },
      {
        items: editable
          ? [
              { key: "d", label: "duplicate", onSelect: () => actions.duplicate(node.path) },
              { key: "m", label: "rename", onSelect: actions.rename },
              { key: "x", label: "delete", danger: true, onSelect: actions.remove },
            ]
          : [],
      },
    ],
  };
}
