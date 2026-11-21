import { menuShortcut, type ActionMenuSpec } from "@/shared/components/ui/action-menu";

export interface MessageMenuInput {
  /** Text selected in the reply when the menu opened. */
  selection: string;
  canFork: boolean;
  canRewind: boolean;
  actions: {
    copy: (text: string) => void;
    quote: (text: string) => void;
    copyMessage: () => void;
    fork: () => void;
    rewind: () => void;
  };
}

/// Right-click on an agent reply: the selected text, then the whole reply.
export function messageMenu({
  selection,
  canFork,
  canRewind,
  actions,
}: MessageMenuInput): ActionMenuSpec {
  const selected = selection.trim();
  return {
    head: selected ? "reply · text selected" : "reply",
    tone: "done",
    groups: [
      {
        label: "selection",
        items: selected
          ? [
              {
                key: "c",
                label: "copy",
                shortcut: menuShortcut(["mod"], "C"),
                onSelect: () => actions.copy(selected),
              },
              { key: "q", label: "quote in reply", onSelect: () => actions.quote(selected) },
            ]
          : [],
      },
      {
        label: "message",
        items: [
          { key: "m", label: "copy message", onSelect: actions.copyMessage },
          ...(canFork ? [{ key: "f", label: "fork from here", onSelect: actions.fork }] : []),
          ...(canRewind ? [{ key: "w", label: "rewind to here", onSelect: actions.rewind }] : []),
        ],
      },
    ],
  };
}
