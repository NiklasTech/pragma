import { invoke } from "@tauri-apps/api/core";

export interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  documentation?: unknown;
  [key: string]: unknown;
}

export interface LspDefinitionTarget {
  filePath: string;
  line: number;
  character: number;
}

export interface LspFeatureFlags {
  completion: boolean;
  completionResolve: boolean;
  completionTriggerCharacters: string[];
  definition: boolean;
}

export async function lspCompletion(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<LspCompletionItem[]> {
  return invoke("lsp_completion", { language, filePath, line, character });
}

export async function lspCompletionResolve(
  language: string,
  filePath: string,
  item: LspCompletionItem,
): Promise<LspCompletionItem> {
  return invoke("lsp_completion_resolve", { language, filePath, item });
}

export async function lspDefinition(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<LspDefinitionTarget | null> {
  return invoke("lsp_definition", { language, filePath, line, character });
}

export async function lspServerCapabilities(
  language: string,
  filePath: string,
): Promise<LspFeatureFlags> {
  return invoke("lsp_server_capabilities", { language, filePath });
}
