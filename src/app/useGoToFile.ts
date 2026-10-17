import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { toGoToFileEntry } from "./goToFileSearch";

interface WorkspaceFiles {
  files: string[];
}

export function useGoToFile(): void {
  const isOpen = useGoToFileStore((state) => state.isOpen);
  const setFiles = useGoToFileStore((state) => state.setFiles);
  const setLoading = useGoToFileStore((state) => state.setLoading);
  const setError = useGoToFileStore((state) => state.setError);
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    if (!isOpen) return;

    if (!rootPath) {
      setFiles(null, []);
      setError("No folder is open.");
      return;
    }

    let cancelled = false;

    async function loadFiles(root: string) {
      // The last listing of this folder stays visible while it refreshes.
      const hasListing = useGoToFileStore.getState().filesRoot === root;
      if (!hasListing) setFiles(root, []);
      setLoading(!hasListing);
      setError(null);

      try {
        const result = await invoke<WorkspaceFiles>("list_workspace_files", {
          workspaceRoot: root,
        });
        if (cancelled) return;
        const files = result.files
          .map((relativePath) => toGoToFileEntry(root, relativePath))
          .sort((a, b) => (a.pathKey < b.pathKey ? -1 : a.pathKey > b.pathKey ? 1 : 0));
        setFiles(root, files);
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
        toast.error(`Failed to list files: ${String(err)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFiles(rootPath);

    return () => {
      cancelled = true;
    };
  }, [isOpen, rootPath, setFiles, setLoading, setError]);
}
