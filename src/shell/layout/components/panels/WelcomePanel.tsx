import { FolderOpen, Plus } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useSettingsStore } from "@/shared/stores/settings";
import { useUiModeStore } from "@/shell/mode";

export default function WelcomePanel() {
  const { selectRoot } = useFileExplorer();
  const recentFolders = useSettingsStore((state) => state.workspace.recentFolders);
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
      <img src="/pragma_logo.svg" alt="Pragma logo" className="h-14 w-14 opacity-80" />
      <p className="text-ui-sm text-fg-muted">Open a folder to edit, or start an agent thread.</p>

      <div className="flex items-center gap-2">
        <Button onClick={() => void selectRoot()}>
          <FolderOpen size={14} />
          Open folder
        </Button>
        <Button variant="outline" onClick={() => setUiMode("agents")}>
          <Plus size={14} />
          New thread
        </Button>
      </div>

      {recentFolders.length > 0 && (
        <div className="flex w-full max-w-xs flex-col gap-0.5 pt-2">
          <span className="px-2 text-left text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase">
            Recent
          </span>
          {recentFolders.slice(0, 5).map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => void selectRoot(path)}
              title={path}
              className="truncate rounded-sm px-2 py-1 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              {getWorkspaceName(path)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
