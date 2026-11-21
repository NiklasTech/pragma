import { menuShortcut, type ActionMenuSpec } from "@/shared/components/ui/action-menu";
import { quoteMarkdown } from "@/shared/lib/quoteMarkdown";

export { quoteMarkdown };

export type MenuContextType = "editor" | "terminal" | "input" | "selection";

interface MenuInput {
  menu: { contextType: MenuContextType; selection: string };
  hasSelection: boolean;
  /** The selection sits in a chat, which can quote it in the reply. */
  inChat: boolean;
  activeTabName: string | null;
  editWithAIShortcut?: string;
  formatShortcut?: string;
  lsp: {
    canGoToDefinition: boolean;
    canFindReferences: boolean;
    canRename: boolean;
    canQuickFix: boolean;
    canFormatDocument: boolean;
  };
  terminalSuggestion: boolean;
  actions: {
    editWithAI: () => void;
    goToDefinition: () => void;
    findReferences: () => void;
    rename: () => void;
    quickFix: () => void;
    formatDocument: () => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    selectAll: () => void;
    quote: () => void;
    clearTerminal: () => void;
    acceptSuggestion: () => void;
    dismissSuggestion: () => void;
  };
}

function lineCount(text: string): number {
  return text.trim() ? text.trim().split("\n").length : 0;
}

function selectionHead(selection: string): string {
  const lines = lineCount(selection);
  return lines > 1 ? `${lines} lines selected` : "1 line selected";
}

/// The menu for a right-click in the editor, a terminal, a text field, or on selected text.
export function buildMenu(input: MenuInput): ActionMenuSpec {
  const { menu, hasSelection, actions, lsp } = input;
  const clipboard = {
    items: [
      {
        key: "x",
        label: "cut",
        shortcut: menuShortcut(["mod"], "X"),
        disabled: !hasSelection,
        onSelect: actions.cut,
      },
      {
        key: "c",
        label: "copy",
        shortcut: menuShortcut(["mod"], "C"),
        disabled: !hasSelection,
        onSelect: actions.copy,
      },
      { key: "v", label: "paste", shortcut: menuShortcut(["mod"], "V"), onSelect: actions.paste },
      {
        key: "s",
        label: "select all",
        shortcut: menuShortcut(["mod"], "A"),
        onSelect: actions.selectAll,
      },
    ],
  };

  if (menu.contextType === "editor") {
    const file = input.activeTabName ?? "editor";
    return {
      head: hasSelection ? `${file} · ${selectionHead(menu.selection)}` : file,
      tone: "info",
      groups: [
        {
          label: "pragma",
          items: [
            {
              key: "e",
              label: "edit with ai",
              shortcut: input.editWithAIShortcut,
              disabled: !hasSelection,
              onSelect: actions.editWithAI,
            },
          ],
        },
        {
          label: "code",
          items: [
            {
              key: "d",
              label: "go to definition",
              shortcut: "F12",
              disabled: !lsp.canGoToDefinition,
              onSelect: actions.goToDefinition,
            },
            {
              key: "r",
              label: "find references",
              shortcut: menuShortcut(["shift"], "F12"),
              disabled: !lsp.canFindReferences,
              onSelect: actions.findReferences,
            },
            {
              key: "n",
              label: "rename symbol",
              shortcut: "F2",
              disabled: !lsp.canRename,
              onSelect: actions.rename,
            },
            {
              key: "q",
              label: "quick fix",
              disabled: !lsp.canQuickFix,
              onSelect: actions.quickFix,
            },
            {
              key: "f",
              label: "format document",
              shortcut: input.formatShortcut,
              disabled: !lsp.canFormatDocument,
              onSelect: actions.formatDocument,
            },
          ],
        },
        clipboard,
      ],
    };
  }

  if (menu.contextType === "terminal") {
    return {
      head: hasSelection ? `terminal · ${selectionHead(menu.selection)}` : "terminal",
      tone: "idle",
      groups: [
        {
          label: "suggestion",
          items: input.terminalSuggestion
            ? [
                {
                  key: "t",
                  label: "accept suggestion",
                  shortcut: "Tab",
                  onSelect: actions.acceptSuggestion,
                },
                {
                  key: "d",
                  label: "dismiss suggestion",
                  shortcut: "Esc",
                  onSelect: actions.dismissSuggestion,
                },
              ]
            : [],
        },
        {
          items: [
            {
              key: "c",
              label: "copy",
              shortcut: menuShortcut(["mod"], "C"),
              disabled: !hasSelection,
              onSelect: actions.copy,
            },
            {
              key: "v",
              label: "paste",
              shortcut: menuShortcut(["mod"], "V"),
              onSelect: actions.paste,
            },
          ],
        },
        { items: [{ key: "k", label: "clear", onSelect: actions.clearTerminal }] },
      ],
    };
  }

  if (menu.contextType === "input") {
    return { head: "text field", tone: "idle", groups: [clipboard] };
  }

  return {
    head: selectionHead(menu.selection),
    tone: "idle",
    groups: [
      {
        label: "selection",
        items: [
          { key: "c", label: "copy", shortcut: menuShortcut(["mod"], "C"), onSelect: actions.copy },
          ...(input.inChat ? [{ key: "q", label: "quote in reply", onSelect: actions.quote }] : []),
        ],
      },
    ],
  };
}
