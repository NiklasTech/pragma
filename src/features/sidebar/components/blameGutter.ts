import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { useGitStore, type GitBlameLine } from "@/shared/stores/git";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useLayoutStore } from "@/shell/layout/store";
import { blameGroupByLine, groupBlameLines, type GitBlameGroup } from "./blameGroups";
import { formatStashDate } from "./stashFormat";

const BLAME_COMMAND_ID = "git.toggleBlameGutter";

class BlameMarker extends GutterMarker {
  private readonly group: GitBlameGroup;
  private readonly onSelect: (sha: string) => void;

  constructor(group: GitBlameGroup, onSelect: (sha: string) => void) {
    super();
    this.group = group;
    this.onSelect = onSelect;
  }

  override eq(other: GutterMarker): boolean {
    return (
      other instanceof BlameMarker &&
      other.group.sha === this.group.sha &&
      other.group.startLine === this.group.startLine
    );
  }

  override toDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "cm-blame-marker";
    element.textContent = `${this.group.author} ${this.group.shortSha}`;
    element.title = `${this.group.author}, ${formatStashDate(this.group.timestampSecs)} (${
      this.group.shortSha
    })`;
    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.onSelect(this.group.sha);
    });
    return element;
  }
}

export function blameGutterExtension(
  lines: GitBlameLine[],
  onSelect: (sha: string) => void,
): Extension {
  const byLine = blameGroupByLine(groupBlameLines(lines));

  return [
    gutter({
      class: "cm-blame-gutter",
      lineMarker(view, line) {
        const number = view.state.doc.lineAt(line.from).number;
        const group = byLine.get(number);
        return group ? new BlameMarker(group, onSelect) : null;
      },
    }),
    EditorView.theme({
      ".cm-blame-gutter": {
        width: "auto",
        minWidth: "0",
      },
      ".cm-blame-marker": {
        padding: "0 6px",
        fontSize: "10px",
        lineHeight: "1.4",
        color: "var(--fg-subtle)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "180px",
        cursor: "pointer",
      },
      ".cm-blame-marker:hover": {
        color: "var(--fg-default)",
      },
    }),
  ];
}

export function openBlameCommit(sha: string): void {
  useGitStore.getState().setBlameSelectedSha(sha);
  const layout = useLayoutStore.getState();
  if (layout.sidebar.collapsed) {
    layout.setSidebarCollapsed(false);
  }
  if (layout.sidebar.tab !== "git-status") {
    layout.setSidebarTab("git-status");
  }
}

useCommandPaletteStore.getState().registerCommand({
  id: BLAME_COMMAND_ID,
  label: "Git: Toggle Blame Gutter",
  category: "Git",
  keywords: ["blame", "annotate", "git"],
  action: () => useGitStore.getState().toggleBlame(),
});
