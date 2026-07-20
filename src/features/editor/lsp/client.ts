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

export interface LspHover {
  contents: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface LspLocation {
  filePath: string;
  range: LspRange;
}

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export interface LspFileEdit {
  filePath: string;
  edits: LspTextEdit[];
}

export interface LspSignatureHelp {
  signatures: Array<{
    label: string;
    documentation?: string;
    parameters: Array<{ label: string; documentation?: string }>;
  }>;
  activeSignature: number;
  activeParameter: number;
}

export interface LspCodeAction {
  title: string;
  kind?: string;
  isPreferred: boolean;
  edits: LspFileEdit[];
}

export interface LspDocumentSymbolItem {
  name: string;
  kind: number;
  detail?: string;
  range: LspRange;
  depth: number;
  containerName?: string;
}

export interface LspWorkspaceSymbolItem {
  name: string;
  kind: number;
  location: LspLocation;
  containerName?: string;
}

export interface LspFeatureFlags {
  completion: boolean;
  completionResolve: boolean;
  completionTriggerCharacters: string[];
  definition: boolean;
  hover: boolean;
  references: boolean;
  formatting: boolean;
  rename: boolean;
  signatureHelp: boolean;
  signatureHelpTriggerCharacters: string[];
  codeAction: boolean;
  documentSymbol: boolean;
  workspaceSymbol: boolean;
  incrementalSync: boolean;
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

export async function lspHover(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<LspHover | null> {
  return invoke("lsp_hover", { language, filePath, line, character });
}

export async function lspReferences(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<LspLocation[]> {
  return invoke("lsp_references", { language, filePath, line, character });
}

export async function lspFormatDocument(
  language: string,
  filePath: string,
  tabSize: number,
  insertSpaces: boolean,
): Promise<LspTextEdit[]> {
  return invoke("lsp_format_document", { language, filePath, tabSize, insertSpaces });
}

export async function lspRename(
  language: string,
  filePath: string,
  line: number,
  character: number,
  newName: string,
): Promise<LspFileEdit[]> {
  return invoke("lsp_rename", { language, filePath, line, character, newName });
}

export async function lspSignatureHelp(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<LspSignatureHelp | null> {
  return invoke("lsp_signature_help", { language, filePath, line, character });
}

export async function lspCodeAction(
  language: string,
  filePath: string,
  range: LspRange,
  diagnostics: unknown[],
): Promise<LspCodeAction[]> {
  return invoke("lsp_code_action", { language, filePath, range, diagnostics });
}

export async function lspDocumentSymbol(
  language: string,
  filePath: string,
): Promise<LspDocumentSymbolItem[]> {
  return invoke("lsp_document_symbol", { language, filePath });
}

export async function lspWorkspaceSymbol(
  language: string,
  filePath: string,
  query: string,
): Promise<LspWorkspaceSymbolItem[]> {
  return invoke("lsp_workspace_symbol", { language, filePath, query });
}

export async function lspServerCapabilities(
  language: string,
  filePath: string,
): Promise<LspFeatureFlags> {
  return invoke("lsp_server_capabilities", { language, filePath });
}
