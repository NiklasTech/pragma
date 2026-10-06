import { quoteShellPath } from "@/features/ai/terminal/buffer";

function shellName(shell: string): string {
  return (shell.split(/[\\/]/).pop() ?? "").toLowerCase();
}

/** Quotes a path so the given shell reads it as a single argument. */
export function quotePathForShell(path: string, shell: string): string {
  const name = shellName(shell);
  if (name.startsWith("pwsh") || name.startsWith("powershell")) {
    return `'${path.replace(/'/g, "''")}'`;
  }
  if (name.startsWith("cmd")) return `"${path}"`;
  return quoteShellPath(path);
}

/** Space separated quoted paths with a trailing space, ready to insert at the prompt. */
export function quotePathsForShell(paths: readonly string[], shell: string): string {
  return `${paths.map((path) => quotePathForShell(path, shell)).join(" ")} `;
}
