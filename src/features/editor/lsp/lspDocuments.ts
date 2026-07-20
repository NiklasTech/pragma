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

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspChangeRange {
  start: LspPosition;
  end: LspPosition;
}

export interface SingleChange {
  range: LspChangeRange;
  text: string;
}

function offsetToLspPosition(text: string, offset: number): LspPosition {
  let line = 0;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, character: offset - lineStart };
}

// Minimal single-edit diff (common prefix/suffix) for incremental didChange.
export function computeSingleChange(oldText: string, newText: string): SingleChange | null {
  if (oldText === newText) {
    return null;
  }

  let start = 0;
  const minLength = Math.min(oldText.length, newText.length);
  while (start < minLength && oldText[start] === newText[start]) {
    start += 1;
  }

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return {
    range: {
      start: offsetToLspPosition(oldText, start),
      end: offsetToLspPosition(oldText, oldEnd),
    },
    text: newText.slice(start, newEnd),
  };
}

async function sendPendingChange(
  language: string,
  filePath: string,
  content: string,
  invokeFn: LspInvokeFn,
): Promise<void> {
  if (!isLspDocumentSynced(filePath)) {
    return;
  }
  const previous = sentContent.get(filePath);
  if (previous === content) {
    return;
  }
  const change = previous === undefined ? null : computeSingleChange(previous, content);
  await invokeFn("lsp_did_change", {
    language,
    filePath,
    content,
    range: change?.range ?? null,
    changeText: change?.text ?? null,
  });
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
