import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useOverlayOpen } from "@/shared/stores/overlays";
import { errorText } from "@/shared/lib/errorText";

/// Lists the folder again in the backend each time Go to opens; searches use the last listing meanwhile.
export function useGoToFile(): void {
  const isOpen = useOverlayOpen("goTo");
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    if (!isOpen) return;
    const { filesRoot, setListed, setLoading, setError } = useGoToFileStore.getState();
    if (!rootPath) {
      setError("No folder is open.");
      return;
    }

    let cancelled = false;
    setLoading(filesRoot !== rootPath);
    setError(null);
    invoke<number>("quick_open_refresh", { workspaceRoot: rootPath })
      .then(() => {
        if (!cancelled) setListed(rootPath);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(String(err));
        toast.error(`Failed to list files: ${errorText(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, rootPath]);
}
