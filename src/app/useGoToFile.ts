import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGoToFileStore } from "@/shared/stores/goToFile";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
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
      setFiles([]);
      setError("No folder is open.");
      return;
    }

    let cancelled = false;

    async function loadFiles() {
      setLoading(true);
      setError(null);

      try {
        const entries = await invoke<DirEntry[]>("list_directory_recursive", { path: rootPath });
        if (cancelled) return;
        const files = entries
          .filter((entry) => entry.is_file)
          .map((entry) => ({ path: entry.path, name: entry.name }));
        setFiles(files);
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
        toast.error(`Failed to list files: ${String(err)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [isOpen, rootPath, setFiles, setLoading, setError]);
}
