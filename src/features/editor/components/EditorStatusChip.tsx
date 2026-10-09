import { useSettingsStore, type StatusbarItem } from "@/shared/stores/settings";
import { useEditorStore } from "@/shared/stores/editor";
import { EncodingMenu } from "@/features/editor/encoding/EncodingMenu";

const CHIP_ITEMS = new Set<StatusbarItem>(["vimMode", "cursor", "fileType", "encoding", "eol"]);

function detectEol(content: string): string {
  return content.includes("\r\n") ? "CRLF" : "LF";
}

interface EditorStatusChipProps {
  panelId: string;
}

/// File details at the end of the breadcrumb row, driven by the statusbar settings.
export function EditorStatusChip({ panelId }: EditorStatusChipProps) {
  const statusbar = useSettingsStore((s) => s.statusbar);
  const vimEnabled = useSettingsStore((s) => s.editor.vimMode);
  const activeTabId = useEditorStore((s) => s.getPanelActiveTabId(panelId));
  const activeTab = useEditorStore((s) => s.tabs.find((tab) => tab.id === activeTabId));
  const cursor = useEditorStore((s) => (activeTabId ? s.cursorPositions[activeTabId] : null));
  const vimMode = useEditorStore((s) => (activeTabId ? (s.vimModes[activeTabId] ?? null) : null));

  if (!statusbar.visible || activeTab?.kind !== "file") return null;

  const ext = activeTab.name.split(".").pop()?.toLowerCase() ?? "";
  const parts: { key: StatusbarItem; label: React.ReactNode }[] = [];

  for (const item of statusbar.items) {
    if (!CHIP_ITEMS.has(item)) continue;
    if (item === "cursor") {
      parts.push({ key: item, label: `Ln ${cursor?.line ?? 1}, Col ${cursor?.column ?? 1}` });
    } else if (item === "fileType") {
      parts.push({ key: item, label: ext ? ext.toUpperCase() : "TXT" });
    } else if (item === "encoding") {
      parts.push({ key: item, label: <EncodingMenu tab={activeTab} /> });
    } else if (item === "eol") {
      parts.push({ key: item, label: detectEol(activeTab.content) });
    }
  }

  const showVim = vimEnabled && statusbar.items.includes("vimMode");
  if (parts.length === 0 && !showVim) return null;

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 pl-3 text-ui-2xs whitespace-nowrap text-fg-subtle tabular-nums">
      {showVim && (
        <span className="rounded-full bg-accent-subtle px-1.5 font-semibold text-primary">
          {vimMode ? vimMode.toUpperCase() : "VIM"}
        </span>
      )}
      {parts.map((part, index) => (
        <span key={part.key} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="size-0.5 rounded-full bg-fg-subtle" />}
          {part.label}
        </span>
      ))}
    </div>
  );
}
