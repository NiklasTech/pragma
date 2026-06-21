import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { FolderOpen, Plus } from "@phosphor-icons/react";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

function entryToNode(entry: DirEntry) {
  return {
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_directory,
    isFile: entry.is_file,
    children: entry.is_directory ? [] : undefined,
  };
}

interface ProjectStepProps {
  onOpenFolder: () => void;
}

export function ProjectStep({ onOpenFolder }: ProjectStepProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const store = useFileExplorerStore();

  const handleCreateProject = async (name: string) => {
    const parent = await open({ multiple: false, directory: true });
    if (typeof parent !== "string" || parent.length === 0) return;

    const separator = parent.includes("/") && !parent.includes("\\") ? "/" : "\\";
    const projectPath = `${parent}${separator}${name}`;

    try {
      await invoke("create_directory", { path: projectPath });
      store.setRootPath(projectPath);
      store.setIsLoading(true);
      const entries = await invoke<DirEntry[]>("list_directory", { path: projectPath });
      store.setTree(entries.map(entryToNode));
      toast.success(`Created project "${name}"`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      store.setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-fg-default">Open a project</h2>
        <p className="text-ui-sm text-fg-muted">
          Open an existing folder or create a new project to start coding.
        </p>
      </div>

      <div className="grid gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-auto justify-start gap-3 p-4"
          onClick={onOpenFolder}
        >
          <FolderOpen size={24} className="text-primary" />
          <div className="text-left">
            <div className="text-ui-base font-medium">Open Folder</div>
            <div className="text-ui-xs text-fg-muted">Select an existing project directory</div>
          </div>
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-auto justify-start gap-3 p-4"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus size={24} className="text-primary" />
          <div className="text-left">
            <div className="text-ui-base font-medium">Create Project</div>
            <div className="text-ui-xs text-fg-muted">Create a new folder and open it</div>
          </div>
        </Button>
      </div>

      <InputDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Project"
        description="Choose a name for your new project. It will be created inside the folder you select next."
        label="Project name"
        confirmLabel="Create"
        onConfirm={handleCreateProject}
      />
    </div>
  );
}
