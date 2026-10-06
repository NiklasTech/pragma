import { AGENT_TOOL_NAMES } from "@/features/agent/tools";

export function normalizePath(path: string): string {
  const replaced = path.replace(/\\/g, "/");
  const stack: string[] = [];
  for (const part of replaced.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return `${replaced.startsWith("/") ? "/" : ""}${stack.join("/")}`;
}

export function isPathInside(root: string, path: string): boolean {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  if (normalizedRoot.length === 0) return false;
  if (normalizedRoot === normalizedPath) return true;
  return normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function isPathApproved(path: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => isPathInside(root, path));
}

export function resolveAgentPath(root: string, path: string): string {
  const trimmed = path.trim();
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed)) return normalizePath(trimmed);
  return normalizePath(`${root.replace(/[\\/]+$/, "")}/${trimmed.replace(/^[\\/]+/, "")}`);
}

export interface AgentFolderCheck {
  approved: boolean;
  resolvedPath: string;
}

export interface AgentAccess {
  agentId: string;
  folders: string[];
}

function readPathInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>).path;
  return typeof value === "string" ? value : "";
}

function readCwdInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>).cwd;
  return typeof value === "string" ? value : "";
}

export function checkAgentToolPath(
  toolName: string,
  input: unknown,
  rootPath: string,
  folders: string[],
): AgentFolderCheck {
  const allowedRoots = [rootPath, ...folders];

  if (toolName === AGENT_TOOL_NAMES.runCommand) {
    const cwd = readCwdInput(input);
    const resolvedPath = cwd ? resolveAgentPath(rootPath, cwd) : normalizePath(rootPath);
    return { approved: isPathApproved(resolvedPath, allowedRoots), resolvedPath };
  }

  const path = readPathInput(input);
  if (!path) {
    return { approved: true, resolvedPath: normalizePath(rootPath) };
  }
  const resolvedPath = resolveAgentPath(rootPath, path);
  return { approved: isPathApproved(resolvedPath, allowedRoots), resolvedPath };
}

export function isFolderScopedTool(toolName: string): boolean {
  return (
    toolName === AGENT_TOOL_NAMES.readFile ||
    toolName === AGENT_TOOL_NAMES.writeFile ||
    toolName === AGENT_TOOL_NAMES.grep ||
    toolName === AGENT_TOOL_NAMES.glob ||
    toolName === AGENT_TOOL_NAMES.searchReplace ||
    toolName === AGENT_TOOL_NAMES.runCommand ||
    toolName === AGENT_TOOL_NAMES.listDir ||
    toolName === AGENT_TOOL_NAMES.getDiagnostics ||
    toolName === AGENT_TOOL_NAMES.findDefinition ||
    toolName === AGENT_TOOL_NAMES.findReferences ||
    toolName === AGENT_TOOL_NAMES.workspaceSymbols
  );
}
