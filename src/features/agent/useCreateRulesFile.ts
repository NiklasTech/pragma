import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { loadProjectRules } from "./rules";
import { PRAGMA_MD_TEMPLATE, PRAGMA_RULES_FILENAME, pragmaRulesPath } from "./rulesTemplate";
import { useAgentStore } from "./store";

export function useCreateRulesFile() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const rules = useAgentStore((state) => state.rules);
  const [creating, setCreating] = useState(false);

  const canCreate = Boolean(rootPath) && rules?.path !== PRAGMA_RULES_FILENAME;

  const createRulesFile = useCallback(async () => {
    if (!rootPath) return;
    if (useAgentStore.getState().rules?.path === PRAGMA_RULES_FILENAME) return;
    setCreating(true);
    try {
      try {
        await invoke("read_text_file", { path: pragmaRulesPath(rootPath) });
        toast.error(`${PRAGMA_RULES_FILENAME} already exists`);
        return;
      } catch {
        // No existing PRAGMA.md, so creating it cannot overwrite anything.
      }
      await invoke("write_text_file", {
        path: pragmaRulesPath(rootPath),
        content: PRAGMA_MD_TEMPLATE,
      });
      const loaded = await loadProjectRules(rootPath);
      useAgentStore.getState().setRules(loaded);
      toast.success(`Created ${PRAGMA_RULES_FILENAME}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  }, [rootPath]);

  return { canCreate, creating, createRulesFile };
}
