import { invoke } from "@tauri-apps/api/core";

export type LspInvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

const syncedDocuments = new Set<string>();
const sentContent = new Map<string, string>();
const pendingFlushes = new Map<string, Promise<void>>();

export function markLspDocumentSynced(filePath: string, content?: string): void {
  syncedDocuments.add(filePath);
  if (content !== undefined) {
    sentContent.set(filePath, content);
  }
}

export function unmarkLspDocument(filePath: string): void {
  syncedDocuments.delete(filePath);
  sentContent.delete(filePath);
}

export function isLspDocumentSynced(filePath: string): boolean {
  return syncedDocuments.has(filePath);
}

export function getLspDocumentSentContent(filePath: string): string | undefined {
  return sentContent.get(filePath);
}

async function sendPendingChange(
  language: string,
  filePath: string,
  content: string,
  invokeFn: LspInvokeFn,
): Promise<void> {
  if (!isLspDocumentSynced(filePath) || sentContent.get(filePath) === content) {
    return;
  }
  await invokeFn("lsp_did_change", { language, filePath, content });
  sentContent.set(filePath, content);
}

// Flushes unsent editor content to the language server so position-based
// requests (completion, definition) never run against a stale document.
export function flushLspDocumentSync(
  language: string,
  filePath: string,
  content: string,
  invokeFn: LspInvokeFn = invoke,
): Promise<void> {
  const previous = pendingFlushes.get(filePath) ?? Promise.resolve();
  const next = previous.then(() => sendPendingChange(language, filePath, content, invokeFn));
  const tracked = next.catch(() => {});
  pendingFlushes.set(filePath, tracked);
  return next.finally(() => {
    if (pendingFlushes.get(filePath) === tracked) {
      pendingFlushes.delete(filePath);
    }
  });
}
