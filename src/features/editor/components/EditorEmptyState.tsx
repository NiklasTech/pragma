import type { Icon } from "@phosphor-icons/react";
import { FileText, MagnifyingGlass, Robot } from "@phosphor-icons/react";

import { useSettingsStore } from "@/shared/stores/settings";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { formatShortcut, getIsMac, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { Kbd } from "@/shared/components/ui/kbd";
import { useUiModeStore } from "@/shell/mode";

interface StartAction {
  label: string;
  hint: string;
  icon: Icon;
  shortcut?: ShortcutActionId;
  run: () => void;
}

export function EditorEmptyState() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const openFile = useOpenFile();
  const openGoToFile = useGoToFileStore((s) => s.open);
  const setUiMode = useUiModeStore((s) => s.setUiMode);
  const isMac = getIsMac();

  const actions: StartAction[] = [
    {
      label: "Go to file",
      hint: "Jump to any file in this folder",
      icon: MagnifyingGlass,
      shortcut: "file.goToFile",
      run: openGoToFile,
    },
    {
      label: "Open file",
      hint: "Pick a file from disk",
      icon: FileText,
      shortcut: "file.open",
      run: openFile,
    },
    {
      label: "Ask an agent",
      hint: "Let Pragma plan and write the change",
      icon: Robot,
      run: () => setUiMode("agents"),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-7 p-6 select-none">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/pragma_logo.svg" alt="" className="h-9 w-auto opacity-80" />
        <p className="text-ui-md font-semibold text-fg-default">Nothing open yet</p>
        <p className="text-ui-sm text-fg-subtle">Pick a starting point.</p>
      </div>

      <div className="flex w-full max-w-[360px] flex-col gap-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.run}
            className="group flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-bg-hover"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-primary">
              <action.icon size={16} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-ui-sm font-medium text-fg-default">{action.label}</span>
              <span className="truncate text-ui-xs text-fg-subtle">{action.hint}</span>
            </span>
            {action.shortcut && (
              <Kbd className="shrink-0">{formatShortcut(shortcuts[action.shortcut], isMac)}</Kbd>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
