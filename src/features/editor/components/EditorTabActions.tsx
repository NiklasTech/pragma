import {
  ArrowCounterClockwise,
  ArrowsLeftRight,
  DotsThree,
  Eye,
  FloppyDisk,
  MagicWand,
  MagnifyingGlass,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { IconButton } from "@/shared/components/ui/icon-button";
import {
  dispatchEditorFind,
  dispatchEditorFormatDocument,
  dispatchEditorReplace,
} from "@/shared/lib/editor-events";
import { formatShortcut, getIsMac, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout/store";

import { reopenClosedTab } from "../reopenClosedTab";

const PREVIEW_EXTENSIONS = /\.(md|mdx|markdown|html?)$/i;

/// The buttons beside a pane's tabs for what the editor otherwise offers only by shortcut.
export function EditorTabActions({ panelId }: { panelId?: string }) {
  const tab = useEditorStore((s) => {
    const id = s.getPanelActiveTabId(panelId ?? null);
    return s.tabs.find((candidate) => candidate.id === id) ?? null;
  });
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const saveFile = useSaveFile();
  const isMac = getIsMac();
  const keys = (id: ShortcutActionId) => formatShortcut(shortcuts[id], isMac);
  const file = tab?.kind === "file" ? tab : null;

  // The editor commands act on the globally active tab, so this pane's tab comes forward first.
  const onThisTab = (run: () => void) => () => {
    if (file) useEditorStore.getState().setActiveTab(file.id);
    run();
  };

  return (
    <>
      {file?.isModified && (
        <IconButton
          icon={FloppyDisk}
          label="Save"
          shortcut={keys("file.save")}
          onClick={onThisTab(() => void saveFile())}
        />
      )}
      {file && PREVIEW_EXTENSIONS.test(file.name) && (
        <IconButton
          icon={Eye}
          label="Preview"
          shortcut={keys("view.togglePreview")}
          onClick={onThisTab(() => useLayoutStore.getState().addFloatingPanel("preview"))}
        />
      )}
      {file && (
        <IconButton
          icon={MagnifyingGlass}
          label="Find in file"
          shortcut={keys("search.find")}
          onClick={onThisTab(dispatchEditorFind)}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<IconButton icon={DotsThree} label="More editor actions" />} />
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem disabled={!file} onClick={onThisTab(dispatchEditorReplace)}>
            <ArrowsLeftRight size={14} />
            Replace in file
            <DropdownMenuShortcut>{keys("search.replace")}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!file} onClick={onThisTab(dispatchEditorFormatDocument)}>
            <MagicWand size={14} />
            Format document
            <DropdownMenuShortcut>{keys("editor.formatDocument")}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void reopenClosedTab(panelId ?? null)}>
            <ArrowCounterClockwise size={14} />
            Reopen closed tab
            <DropdownMenuShortcut>{keys("file.reopenClosedTab")}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
