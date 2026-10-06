import { invoke } from "@tauri-apps/api/core";

import { formatProblemList, selectProblems } from "@/shared/lib/problemsReport";
import { fetchUrlText, formatFetchedUrl } from "@/shared/lib/webFetch";
import { useEditorStore } from "@/shared/stores/editor";
import { useProblemsStore } from "@/shared/stores/problems";

import { findDefinition, findReferences, findWorkspaceSymbols } from "./lspTools";
import { AGENT_TOOL_NAMES } from "./tools";
import { readNumberInput, readStringInput, resolveWorkspacePath } from "./toolInput";

interface WorkspaceDirEntry {
  name: string;
  isDirectory: boolean;
  size: number | null;
}

interface ListWorkspaceDirResult {
  path: string;
  entries: WorkspaceDirEntry[];
  truncated: boolean;
}

const INSIGHT_TOOLS: ReadonlySet<string> = new Set([
  AGENT_TOOL_NAMES.listDir,
  AGENT_TOOL_NAMES.getDiagnostics,
  AGENT_TOOL_NAMES.findDefinition,
  AGENT_TOOL_NAMES.findReferences,
  AGENT_TOOL_NAMES.workspaceSymbols,
  AGENT_TOOL_NAMES.webFetch,
]);

const MAX_DIAGNOSTICS = 200;
const MAX_FETCH_CHARS = 50_000;

export function isInsightTool(toolName: string): boolean {
  return INSIGHT_TOOLS.has(toolName);
}

export function insightStepLabel(
  toolName: string,
  input: unknown,
): { label: string; detail?: string } | null {
  switch (toolName) {
    case AGENT_TOOL_NAMES.listDir:
      return { label: "List directory", detail: readStringInput(input, "path") || undefined };
    case AGENT_TOOL_NAMES.getDiagnostics:
      return { label: "Check problems", detail: readStringInput(input, "path") || undefined };
    case AGENT_TOOL_NAMES.findDefinition:
      return { label: "Find definition", detail: readStringInput(input, "symbol") };
    case AGENT_TOOL_NAMES.findReferences:
      return { label: "Find references", detail: readStringInput(input, "symbol") };
    case AGENT_TOOL_NAMES.workspaceSymbols:
      return { label: "Find symbols", detail: readStringInput(input, "query") };
    case AGENT_TOOL_NAMES.webFetch:
      return { label: "Fetch URL", detail: readStringInput(input, "url") };
    default:
      return null;
  }
}

function formatSize(size: number | null): string {
  if (size === null) return "";
  if (size < 1024) return ` (${size} B)`;
  if (size < 1024 * 1024) return ` (${(size / 1024).toFixed(1)} KB)`;
  return ` (${(size / (1024 * 1024)).toFixed(1)} MB)`;
}

async function listDir(input: unknown, rootPath: string) {
  const pathInput = readStringInput(input, "path");
  const result = await invoke<ListWorkspaceDirResult>("list_workspace_dir", {
    req: {
      workspaceRoot: rootPath,
      path: pathInput ? resolveWorkspacePath(rootPath, pathInput) : null,
    },
  });
  const lines = result.entries.map((entry) =>
    entry.isDirectory ? `${entry.name}/` : `${entry.name}${formatSize(entry.size)}`,
  );
  if (result.truncated) lines.push("... [truncated]");
  return {
    output: `${result.path}\n${lines.join("\n") || "(empty)"}`,
    detail: `${result.entries.length}${result.truncated ? "+" : ""} entries`,
  };
}

function getDiagnostics(input: unknown, rootPath: string) {
  const pathInput = readStringInput(input, "path");
  const filePath = pathInput ? resolveWorkspacePath(rootPath, pathInput) : undefined;
  const problems = selectProblems(
    useProblemsStore.getState().problems,
    ["error", "warning"],
    filePath,
  );
  const errors = problems.filter((p) => p.severity === "error").length;
  const detail = `${errors} errors, ${problems.length - errors} warnings`;

  if (problems.length === 0) {
    const isOpen =
      filePath === undefined ||
      useEditorStore.getState().tabs.some((tab) => tab.kind === "file" && tab.path === filePath);
    const note = isOpen
      ? ""
      : " The file is not open in the editor, so no language server checked it. Run the project's type checker or linter to check it.";
    return { output: `No errors or warnings.${note}`, detail };
  }

  return { output: formatProblemList(problems, MAX_DIAGNOSTICS), detail };
}

async function webFetch(input: unknown) {
  const result = await fetchUrlText(readStringInput(input, "url"));
  return { output: formatFetchedUrl(result, MAX_FETCH_CHARS), detail: `HTTP ${result.status}` };
}

export async function dispatchInsightTool(
  toolName: string,
  input: unknown,
  rootPath: string,
): Promise<{ output: string; detail?: string }> {
  const filePath = () => resolveWorkspacePath(rootPath, readStringInput(input, "path"));
  const line = readNumberInput(input, "line") ?? 0;
  const symbol = readStringInput(input, "symbol");

  switch (toolName) {
    case AGENT_TOOL_NAMES.listDir:
      return listDir(input, rootPath);
    case AGENT_TOOL_NAMES.getDiagnostics:
      return getDiagnostics(input, rootPath);
    case AGENT_TOOL_NAMES.findDefinition:
      return { output: await findDefinition(filePath(), line, symbol) };
    case AGENT_TOOL_NAMES.findReferences: {
      const { output, count } = await findReferences(filePath(), line, symbol);
      return { output, detail: `${count} references` };
    }
    case AGENT_TOOL_NAMES.workspaceSymbols: {
      const query = readStringInput(input, "query");
      const { output, count } = await findWorkspaceSymbols(filePath(), query);
      return { output, detail: `${count} symbols` };
    }
    case AGENT_TOOL_NAMES.webFetch:
      return webFetch(input);
    default:
      throw new Error(`Unknown agent tool: ${toolName}`);
  }
}
