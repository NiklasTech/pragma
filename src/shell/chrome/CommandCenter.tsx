import { MagnifyingGlass } from "@phosphor-icons/react";

import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useSettingsStore } from "@/shared/stores/settings";

export function CommandCenter() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const shortcut = useSettingsStore((s) => s.shortcuts["file.goToFile"]);
  const openGoToFile = useGoToFileStore((s) => s.open);
  const workspaceName = getWorkspaceName(rootPath);

  return (
    <button
      type="button"
      onClick={openGoToFile}
      aria-label="Go to file"
      className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-ui-xs text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-muted"
    >
      <MagnifyingGlass size={13} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">
        {workspaceName ? `Search in ${workspaceName}` : "Search files"}
      </span>
      <Kbd className="h-4 bg-transparent text-ui-2xs">{formatShortcut(shortcut, getIsMac())}</Kbd>
    </button>
  );
}
