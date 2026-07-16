import { invoke } from "@tauri-apps/api/core";

import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { isLspDocumentSynced, unmarkLspDocument } from "./lspDocuments";

export type LspInvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

export function fileTabPaths(): string[] {
  return useEditorStore
    .getState()
    .tabs.filter((tab) => tab.kind === "file")
    .map((tab) => tab.path);
}

export function findClosedFilePaths(previousPaths: string[], nextPaths: string[]): string[] {
  const next = new Set(nextPaths);
  return previousPaths.filter((path) => !next.has(path));
}

export function startLspDidCloseWatcher(invokeFn: LspInvokeFn = invoke): () => void {
  let previousPaths = fileTabPaths();

  return useEditorStore.subscribe(() => {
    const nextPaths = fileTabPaths();
    const closedPaths = findClosedFilePaths(previousPaths, nextPaths);
    previousPaths = nextPaths;

    for (const filePath of closedPaths) {
      if (!isLspDocumentSynced(filePath)) {
        continue;
      }
      unmarkLspDocument(filePath);

      const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
      const language = detectLanguage(fileName);
      if (!language || !isLspSupported(language)) {
        continue;
      }

      const settings = useSettingsStore.getState();
      const enabled = settings.experimental.lsp && (settings.lsp.enabled[language] ?? true);
      if (!enabled) {
        continue;
      }

      void invokeFn("lsp_did_close", { language, filePath }).catch(() => {});
    }
  });
}
