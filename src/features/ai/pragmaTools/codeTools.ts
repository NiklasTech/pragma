import {
  findDefinition,
  findReferences,
  findWorkspaceSymbols,
  locateSymbol,
  withLspDocument,
} from "@/features/agent/lspTools";
import { readNumberInput, readStringInput, resolveWorkspacePath } from "@/features/agent/toolInput";
import { lspDocumentSymbol, lspHover } from "@/features/editor/lsp/client";
import { symbolKindName } from "@/features/editor/lsp/symbols";

import { diagnosticsReport } from "./diagnostics";
import { renameSymbol, RENAME_TOOL } from "./rename";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const MAX_SYMBOLS = 300;

function filePath(args: unknown, context: PragmaToolContext): string {
  const path = readStringInput(args, "path");
  if (!path.trim()) throw new Error("path is required");
  return resolveWorkspacePath(context.cwd, path);
}

function line(args: unknown): number {
  return readNumberInput(args, "line") ?? 0;
}

async function hover(args: unknown, context: PragmaToolContext): Promise<string> {
  const path = filePath(args, context);
  const symbol = readStringInput(args, "symbol");
  const result = await withLspDocument(path, (language, content) => {
    const position = locateSymbol(content, line(args), symbol);
    return lspHover(language, path, position.line, position.character);
  });
  return result?.contents.trim() || `The language server has no information on "${symbol}".`;
}

async function documentSymbols(args: unknown, context: PragmaToolContext): Promise<string> {
  const path = filePath(args, context);
  const symbols = await withLspDocument(path, (language) => lspDocumentSymbol(language, path));
  if (symbols.length === 0) return `The language server found no symbols in ${path}.`;
  const rows = symbols.slice(0, MAX_SYMBOLS).map((item) => {
    const detail = item.detail ? ` ${item.detail}` : "";
    const indent = "  ".repeat(item.depth);
    return `${indent}${symbolKindName(item.kind)} ${item.name}${detail}: line ${item.range.start.line + 1}`;
  });
  if (symbols.length > MAX_SYMBOLS) rows.push(`... ${symbols.length - MAX_SYMBOLS} more symbols`);
  return rows.join("\n");
}

export const CODE_TOOLS: Record<string, PragmaToolHandler> = {
  lsp_diagnostics: async (args, context) => {
    const path = readStringInput(args, "path").trim();
    return diagnosticsReport(path ? resolveWorkspacePath(context.cwd, path) : null);
  },
  lsp_definition: async (args, context) =>
    findDefinition(filePath(args, context), line(args), readStringInput(args, "symbol")),
  lsp_references: async (args, context) => {
    const symbol = readStringInput(args, "symbol");
    return (await findReferences(filePath(args, context), line(args), symbol)).output;
  },
  lsp_hover: hover,
  lsp_document_symbols: documentSymbols,
  lsp_workspace_symbols: async (args, context) => {
    const query = readStringInput(args, "query");
    return (await findWorkspaceSymbols(filePath(args, context), query)).output;
  },
  [RENAME_TOOL]: renameSymbol,
};
