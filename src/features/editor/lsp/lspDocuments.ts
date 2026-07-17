const syncedDocuments = new Set<string>();

export function markLspDocumentSynced(filePath: string): void {
  syncedDocuments.add(filePath);
}

export function unmarkLspDocument(filePath: string): void {
  syncedDocuments.delete(filePath);
}

export function isLspDocumentSynced(filePath: string): boolean {
  return syncedDocuments.has(filePath);
}
