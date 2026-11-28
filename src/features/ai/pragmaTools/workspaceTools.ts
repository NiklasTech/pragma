import { invoke } from "@tauri-apps/api/core";

import { readStringInput, resolveWorkspacePath } from "@/features/agent/toolInput";
import { useAIStore } from "@/shared/stores/ai";
import type { GitStatusSnapshot } from "@/shared/stores/git/types";
import type { HistoryEntry } from "@/shared/stores/localHistory";
import type { RunConfig } from "@/shared/stores/runConfig";

import { requestSpawnApproval } from "../children/acpSpawn";
import { sessionEnvironment } from "../worktree/cwd";
import { editsNeedApproval } from "./rename";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const MAX_CHANGED_FILES = 50;
const MAX_HISTORY = 30;
const MAX_PATCH_CHARS = 30_000;

/** Files whose presence names the stack, checked in the working folder. */
const STACK_MARKERS: Record<string, string> = {
  "package.json": "Node.js",
  "tsconfig.json": "TypeScript",
  "Cargo.toml": "Rust",
  "go.mod": "Go",
  "pyproject.toml": "Python",
  "requirements.txt": "Python",
  "pom.xml": "Java (Maven)",
  "build.gradle": "Java/Kotlin (Gradle)",
  "build.gradle.kts": "Kotlin (Gradle)",
  Gemfile: "Ruby",
  "composer.json": "PHP",
  "Package.swift": "Swift",
  "deno.json": "Deno",
  Dockerfile: "Docker",
  "docker-compose.yml": "Docker Compose",
  "compose.yaml": "Docker Compose",
};

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

async function gitSection(cwd: string): Promise<string> {
  try {
    const { snapshot } = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", {
      repoPath: cwd,
    });
    const { repo, changed_files: changed, ahead, behind } = snapshot;
    const branch = repo.is_detached ? "detached HEAD" : repo.branch;
    const upstream = repo.upstream
      ? `, tracking ${repo.upstream} (${ahead} ahead, ${behind} behind)`
      : "";
    const files = changed.slice(0, MAX_CHANGED_FILES).map((file) => `  ${file.path}`);
    if (changed.length > MAX_CHANGED_FILES)
      files.push(`  ... ${changed.length - MAX_CHANGED_FILES} more`);
    const list =
      files.length > 0 ? `\nChanged files:\n${files.join("\n")}` : "\nNo uncommitted changes.";
    return `Git: branch ${branch}${upstream}${list}`;
  } catch {
    return "Git: not a git repository.";
  }
}

async function runSection(rootPath: string): Promise<string> {
  const [saved, detected] = await Promise.all([
    invoke<RunConfig[]>("run_list_configs", { workspaceRoot: rootPath }).catch(() => []),
    invoke<RunConfig[]>("run_detect_configs", { workspaceRoot: rootPath }).catch(() => []),
  ]);
  const names = new Set(saved.map((config) => config.name));
  const configs = [...saved, ...detected.filter((config) => !names.has(config.name))];
  if (configs.length === 0) return "Run configurations: none.";
  const rows = configs.map((config) => `  ${config.name}: ${config.command}`);
  return `Run configurations:\n${rows.join("\n")}`;
}

async function stackSection(cwd: string): Promise<string> {
  const listing = await invoke<{ entries: DirEntry[] }>("list_workspace_dir", {
    req: { workspaceRoot: cwd, path: null },
  }).catch(() => ({ entries: [] }));
  const found = new Set(listing.entries.flatMap((entry) => STACK_MARKERS[entry.name] ?? []));
  return `Stack: ${found.size > 0 ? [...found].join(", ") : "not detected"}.`;
}

async function workspaceInfo(_args: unknown, context: PragmaToolContext): Promise<string> {
  const { chatSessions, workEnvironments } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === context.sessionId);
  const environment = sessionEnvironment(session, workEnvironments);
  const place =
    environment?.kind === "worktree"
      ? `Worktree on branch ${environment.branch}${environment.baseBranch ? `, from ${environment.baseBranch}` : ""}`
      : "The project's main checkout";
  const sections = await Promise.all([
    gitSection(context.cwd),
    runSection(context.rootPath),
    stackSection(context.cwd),
  ]);
  return [
    `Project: ${context.rootPath}`,
    `Working folder: ${context.cwd}`,
    `${place}.`,
    ...sections,
  ].join("\n");
}

function requiredPath(args: unknown, context: PragmaToolContext): string {
  const path = readStringInput(args, "path").trim();
  if (!path) throw new Error("path is required");
  return resolveWorkspacePath(context.cwd, path);
}

async function historyEntries(filePath: string): Promise<HistoryEntry[]> {
  const { entries } = await invoke<{ entries: HistoryEntry[] }>("local_history_entries", {
    filePath,
    limit: MAX_HISTORY,
  });
  return entries;
}

async function findEntry(filePath: string, id: string): Promise<HistoryEntry> {
  const entry = (await historyEntries(filePath)).find((item) => item.id === id);
  if (!entry) throw new Error(`No version ${id} of ${filePath}; list them with local_history.`);
  return entry;
}

function describe(entry: HistoryEntry): string {
  const when = new Date(entry.timestamp * 1000).toISOString();
  const what = entry.kind === "git" ? `commit by ${entry.author}: ${entry.message}` : "snapshot";
  return `${entry.id}  ${when}  ${what}`;
}

async function localHistory(args: unknown, context: PragmaToolContext): Promise<string> {
  const filePath = requiredPath(args, context);
  const id = readStringInput(args, "entry").trim();
  if (!id) {
    const entries = await historyEntries(filePath);
    if (entries.length === 0) return `Pragma has no earlier versions of ${filePath}.`;
    return `Versions of ${filePath}, newest first:\n${entries.map(describe).join("\n")}`;
  }
  const entry = await findEntry(filePath, id);
  const { patchText } = await invoke<{ patchText: string }>("local_history_diff", {
    filePath,
    entryId: entry.id,
    kind: entry.kind,
  });
  const meaning =
    entry.kind === "git"
      ? "What this commit changed in the file:"
      : "How the file changed since this snapshot (- snapshot, + now):";
  const patch =
    patchText.length > MAX_PATCH_CHARS
      ? `${patchText.slice(0, MAX_PATCH_CHARS)}\n... [cut]`
      : patchText;
  return `${meaning}\n${patch || "(no difference)"}`;
}

async function restore(args: unknown, context: PragmaToolContext): Promise<string> {
  const filePath = requiredPath(args, context);
  const entry = await findEntry(filePath, readStringInput(args, "entry").trim());
  if (editsNeedApproval(context.rootPath)) {
    const allowed = await requestSpawnApproval(context.sessionId, {
      toolCallId: context.requestId,
      toolName: "local_history_restore",
      args,
      description: `${filePath} to ${describe(entry)}`,
    });
    if (!allowed) return "The user did not allow the restore. Nothing changed.";
  }
  await invoke("local_history_restore", { filePath, entryId: entry.id, kind: entry.kind });
  return `Restored ${filePath} to version ${entry.id}.`;
}

export const WORKSPACE_TOOLS: Record<string, PragmaToolHandler> = {
  workspace_info: workspaceInfo,
  local_history: localHistory,
  local_history_restore: restore,
};
