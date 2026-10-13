import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { isSkillPath } from "./paths";
import { useSkillsStore } from "./store";

/// Loads the skills of the open folder and again whenever a file in a skill folder changes.
export function useSkillsSync(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    const { loadSkills } = useSkillsStore.getState();
    void loadSkills(rootPath);
    if (!rootPath) return;

    const unlisten = listen<{ root: string; paths: string[] }>("workspace-fs-changed", (event) => {
      if (event.payload.root !== rootPath) return;
      if (event.payload.paths.some(isSkillPath)) void loadSkills(rootPath);
    });
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [rootPath]);
}
