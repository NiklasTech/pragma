import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/// Every file of the folder, relative to it, loaded once while `active` and reused after.
export function useWorkspaceFileList(root: string | null, active: boolean): string[] | null {
  const [listing, setListing] = useState<{ root: string; files: string[] } | null>(null);

  useEffect(() => {
    if (!active || !root || listing?.root === root) return;
    let live = true;
    invoke<{ files: string[] }>("list_workspace_files", { workspaceRoot: root })
      .then((result) => live && setListing({ root, files: result.files }))
      .catch(() => live && setListing({ root, files: [] }));
    return () => {
      live = false;
    };
  }, [active, root, listing?.root]);

  return listing?.root === root ? listing.files : null;
}
