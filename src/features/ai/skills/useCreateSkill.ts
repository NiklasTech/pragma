import { useCallback, useState } from "react";
import { toast } from "sonner";

import { openWorkspaceFile } from "@/features/ai/components/openWorkspaceFile";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useUiModeStore } from "@/shell/mode";

import { createSkillFile } from "./storage";
import { useSkillsStore } from "./store";

export function useCreateSkill() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const editorPanelId = useEditorPanelId();
  const setUiMode = useUiModeStore((state) => state.setUiMode);
  const [creating, setCreating] = useState(false);

  const createSkill = useCallback(async () => {
    if (!rootPath) return;
    setCreating(true);
    try {
      const path = await createSkillFile(rootPath);
      await useSkillsStore.getState().loadSkills(rootPath);
      if (await openWorkspaceFile(path, editorPanelId)) setUiMode("editor");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  }, [editorPanelId, rootPath, setUiMode]);

  return { canCreate: Boolean(rootPath), creating, createSkill };
}
