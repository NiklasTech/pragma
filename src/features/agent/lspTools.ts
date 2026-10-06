import { invoke } from "@tauri-apps/api/core";

import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  lspDefinition,
  lspReferences,
  lspWorkspaceSymbol,
  type LspLocation,
} from "@/features/editor/lsp/client";
import { flushLspDocumentSync, isLspDocumentSynced } from "@/features/editor/lsp/lspDocuments";
import { symbolKindName } from "@/features/editor/lsp/symbols";

interface FileReadResult {
  content: string;
}

interface LspPosition {
  line: number;
  character: number;
}

const MAX_LOCATIONS = 100;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Turns the 1-based line and symbol name the model knows into an LSP position.
export function locateSymbol(content: string, line: number, symbol: string): LspPosition {
  const name = symbol.trim();
  if (!name) throw new Error("symbol is required");
  const lines = content.split("\n");
  const text = Number.isInteger(line) ? lines[line - 1] : undefined;
  if (text === undefined) {
    throw new Error(`Line ${line} is outside the file, which has ${lines.length} lines`);
  }
  const wholeWord = new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`).exec(text);
  const character = wholeWord ? wholeWord.index : text.indexOf(name);
  if (character < 0) throw new Error(`"${name}" does not appear on line ${line}`);
  return { line: line - 1, character };
}

function editorContent(filePath: string): string | undefined {
  const tab = useEditorStore
    .getState()
    .tabs.find((candidate) => candidate.kind === "file" && candidate.path === filePath);
  return tab?.kind === "file" ? tab.content : undefined;
}

async function readContent(filePath: string): Promise<string> {
  const open = editorContent(filePath);
  if (open !== undefined) return open;
  const result = await invoke<FileReadResult>("read_text_file", { path: filePath });
  return result.content;
}

function resolveLanguage(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const language = detectLanguage(fileName);
  if (!language || !isLspSupported(language)) {
    throw new Error(`No language server supports ${fileName}`);
  }
  const settings = useSettingsStore.getState();
  if (!settings.experimental.lsp || !(settings.lsp.enabled[language] ?? true)) {
    throw new Error(`The ${language} language server is turned off in the settings`);
  }
  return language;
}

// Runs a request against the file's language server. A file the editor has not
// opened is opened for the request and closed again afterwards.
export async function withLspDocument<T>(
  filePath: string,
  run: (language: string, content: string) => Promise<T>,
): Promise<T> {
  const language = resolveLanguage(filePath);
  const content = await readContent(filePath);
  if (isLspDocumentSynced(filePath)) {
    await flushLspDocumentSync(language, filePath, content).catch(() => {});
    return run(language, content);
  }
  await invoke("lsp_did_open", { language, filePath, content });
  try {
    return await run(language, content);
  } finally {
    void invoke("lsp_did_close", { language, filePath }).catch(() => {});
  }
}

async function formatLocations(
  locations: { filePath: string; line: number; character: number }[],
): Promise<string> {
  const contents = new Map<string, Promise<string[] | null>>();
  const linesOf = (filePath: string) => {
    let cached = contents.get(filePath);
    if (!cached) {
      cached = readContent(filePath)
        .then((content) => content.split("\n"))
        .catch(() => null);
      contents.set(filePath, cached);
    }
    return cached;
  };
  const rows = await Promise.all(
    locations.map(async ({ filePath, line, character }) => {
      const preview = (await linesOf(filePath))?.[line]?.trim();
      const location = `${filePath}:${line + 1}:${character + 1}`;
      return preview ? `${location}: ${preview}` : location;
    }),
  );
  return rows.join("\n");
}

function toPoint(location: LspLocation) {
  return {
    filePath: location.filePath,
    line: location.range.start.line,
    character: location.range.start.character,
  };
}

export async function findDefinition(
  filePath: string,
  line: number,
  symbol: string,
): Promise<string> {
  const target = await withLspDocument(filePath, (language, content) => {
    const position = locateSymbol(content, line, symbol);
    return lspDefinition(language, filePath, position.line, position.character);
  });
  if (!target) return `No definition found for "${symbol}".`;
  return formatLocations([target]);
}

export async function findReferences(
  filePath: string,
  line: number,
  symbol: string,
): Promise<{ output: string; count: number }> {
  const locations = await withLspDocument(filePath, (language, content) => {
    const position = locateSymbol(content, line, symbol);
    return lspReferences(language, filePath, position.line, position.character);
  });
  if (locations.length === 0) return { output: `No references found for "${symbol}".`, count: 0 };
  const shown = await formatLocations(locations.slice(0, MAX_LOCATIONS).map(toPoint));
  const more =
    locations.length > MAX_LOCATIONS
      ? `\n... ${locations.length - MAX_LOCATIONS} more references`
      : "";
  return { output: `${shown}${more}`, count: locations.length };
}

export async function findWorkspaceSymbols(
  filePath: string,
  query: string,
): Promise<{ output: string; count: number }> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("query is required");
  const symbols = await withLspDocument(filePath, (language) =>
    lspWorkspaceSymbol(language, filePath, trimmed),
  );
  if (symbols.length === 0) return { output: `No symbols match "${trimmed}".`, count: 0 };
  const output = symbols
    .slice(0, MAX_LOCATIONS)
    .map((item) => {
      const { filePath: path, line, character } = toPoint(item.location);
      const container = item.containerName ? ` in ${item.containerName}` : "";
      return `${symbolKindName(item.kind)} ${item.name}${container}: ${path}:${line + 1}:${character + 1}`;
    })
    .join("\n");
  return { output, count: symbols.length };
}
