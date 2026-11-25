import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { errorText } from "@/shared/lib/errorText";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

function homePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

/// Opens or creates the folder to work in; each folder becomes a space.
export function ProjectBlock() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const branch = useGitStore((state) => state.snapshot?.repo.branch ?? null);
  const gitLoading = useGitStore((state) => !state.snapshot && state.isLoading);
  const { selectRoot } = useFileExplorer();
  const [creating, setCreating] = useState(false);

  const createProject = async (name: string) => {
    const parent = await open({ multiple: false, directory: true });
    if (typeof parent !== "string" || parent.length === 0) return;
    const separator = parent.includes("/") && !parent.includes("\\") ? "/" : "\\";
    const projectPath = `${parent}${separator}${name}`;
    const store = useFileExplorerStore.getState();
    try {
      await invoke("create_directory", { path: projectPath });
      useOpenRepositoriesStore.getState().add(projectPath);
      store.setRootPath(projectPath);
      store.setIsLoading(true);
      const entries = await invoke<DirEntry[]>("list_directory", { path: projectPath });
      store.setTree(
        entries.map((entry) => ({
          path: entry.path,
          name: entry.name,
          isDirectory: entry.is_directory,
          isFile: entry.is_file,
          children: entry.is_directory ? [] : undefined,
        })),
      );
      toast.success(`Created project "${name}"`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      store.setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {rootPath ? (
        <>
          <div className="flex items-center gap-3.5 rounded-well bg-bg-sheet p-3.5 shadow-[0_0_0_3px_var(--color-accent-glow)] ring-1 ring-primary ring-inset">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-bg-active font-mono font-semibold text-fg-default">
              {getWorkspaceName(rootPath).charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-ui-base font-semibold text-fg-default">
                {getWorkspaceName(rootPath)}
              </span>
              <span className="truncate font-mono text-ui-2xs text-fg-muted">
                {[homePath(rootPath), branch].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => void selectRoot()}>
              Change
            </Button>
          </div>
          {!gitLoading && (
            <span className="font-mono text-ui-xs text-fg-subtle">
              {branch
                ? "git repository · every agent can get its own worktree"
                : "no git · agents work in this folder"}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="ghost"
              onClick={() => void selectRoot()}
              className="h-auto flex-col items-start justify-start gap-2 bg-bg-sheet p-3.5 text-left font-normal whitespace-normal ring-1 ring-border ring-inset"
            >
              <span className="text-ui-base font-semibold text-fg-default">Open a folder</span>
              <span className="font-sans text-ui-xs leading-snug text-fg-muted">
                It becomes a space with its own tabs and agents.
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCreating(true)}
              className="h-auto flex-col items-start justify-start gap-2 p-3.5 text-left font-normal whitespace-normal ring-1 ring-border-subtle ring-inset"
            >
              <span className="text-ui-base font-semibold text-fg-default">Create a project</span>
              <span className="font-sans text-ui-xs leading-snug text-fg-muted">
                A new folder, opened right away.
              </span>
            </Button>
          </div>
          <span className="text-ui-xs text-fg-subtle">
            Optional. Without a folder Pragma opens on the start screen.
          </span>
        </>
      )}
      <InputDialog
        open={creating}
        onOpenChange={setCreating}
        title="Create Project"
        description="Choose a name for your new project. It will be created inside the folder you select next."
        label="Project name"
        confirmLabel="Create"
        onConfirm={createProject}
      />
    </div>
  );
}
