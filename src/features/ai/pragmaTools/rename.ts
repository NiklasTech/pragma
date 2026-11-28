import { locateSymbol, withLspDocument } from "@/features/agent/lspTools";
import { readNumberInput, readStringInput, resolveWorkspacePath } from "@/features/agent/toolInput";
import { lspRename, type LspFileEdit } from "@/features/editor/lsp/client";
import { applyWorkspaceEdits } from "@/features/editor/lsp/workspaceEdits";
import { useSettingsStore } from "@/shared/stores/settings";
import { getAgentSettings } from "@/shared/stores/workspaceSettings/effective";

import { requestSpawnApproval } from "../children/acpSpawn";
import type { PragmaToolContext } from "./types";

export const RENAME_TOOL = "lsp_rename";

function changedFiles(edits: LspFileEdit[]): string {
  return edits
    .filter((file) => file.edits.length > 0)
    .map((file) => `${file.filePath} (${file.edits.length})`)
    .join("\n");
}

/// Renames edit files, so they follow the agent setting for edits like Pragma's own agent.
export function editsNeedApproval(rootPath: string): boolean {
  if (useSettingsStore.getState().ai.yoloMode) return false;
  const { autoApprove } = getAgentSettings(rootPath);
  return autoApprove !== "all" && autoApprove !== "edits";
}

export async function renameSymbol(args: unknown, context: PragmaToolContext): Promise<string> {
  const filePath = resolveWorkspacePath(context.cwd, readStringInput(args, "path"));
  const symbol = readStringInput(args, "symbol");
  const newName = readStringInput(args, "new_name").trim();
  if (!newName) throw new Error("new_name is required");
  const edits = await withLspDocument(filePath, (language, content) => {
    const position = locateSymbol(content, readNumberInput(args, "line") ?? 0, symbol);
    return lspRename(language, filePath, position.line, position.character, newName);
  });
  const files = changedFiles(edits);
  if (!files) return `The language server found nothing to rename for "${symbol}".`;

  if (editsNeedApproval(context.rootPath)) {
    const allowed = await requestSpawnApproval(context.sessionId, {
      toolCallId: context.requestId,
      toolName: RENAME_TOOL,
      args,
      description: files,
    });
    if (!allowed) return "The user did not allow the rename. Nothing changed.";
  }
  await applyWorkspaceEdits(edits);
  return `Renamed "${symbol}" to "${newName}" in:\n${files}`;
}
