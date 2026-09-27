import { invoke } from "@tauri-apps/api/core";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { useSettingsStore } from "@/shared/stores/settings";

import {
  checkAgentToolPath,
  isFolderScopedTool,
  type AgentAccess,
} from "@/features/ai/named-agents/folders";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { isSkillPath } from "@/features/ai/skills/paths";
import { useSkillsStore } from "@/features/ai/skills/store";

import { useAgentStore, type AgentStep, type AgentTodo } from "./store";
import { resolveAgentApproval, type AgentApprovalDecision } from "./permissions";
import { AGENT_TOOL_NAMES, isFileEditTool } from "./tools";
import { applySearchReplace } from "./searchReplace";
import { sliceFileLines } from "./readSlice";
import { applyAgentFileEdit } from "./applyEdit";

export interface AgentToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export type AgentToolResult = { output: string } | { errorText: string };

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchText: string;
}

interface AgentCommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
}

const MAX_TOOL_OUTPUT_CHARS = 50_000;
const MAX_SEARCH_MATCHES = 100;

function readStringInput(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readNumberInput(input: unknown, key: string): number | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBooleanInput(input: unknown, key: string): boolean {
  if (typeof input !== "object" || input === null) return false;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : false;
}

function readTodoItems(input: unknown): AgentTodo[] {
  if (typeof input !== "object" || input === null) return [];
  const raw = (input as Record<string, unknown>).items;
  if (!Array.isArray(raw)) return [];
  const items: AgentTodo[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    const status =
      item.status === "pending" || item.status === "in_progress" || item.status === "done"
        ? item.status
        : "pending";
    items.push({ id, content: typeof item.content === "string" ? item.content : "", status });
  }
  return items;
}

function resolveWorkspacePath(rootPath: string, path: string): string {
  const trimmed = path.trim();
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed)) {
    return trimmed;
  }
  return `${rootPath.replace(/[\\/]+$/, "")}/${trimmed.replace(/^[\\/]+/, "")}`;
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n... [truncated]`;
}

export function stepLabel(toolName: string, input: unknown): { label: string; detail?: string } {
  switch (toolName) {
    case AGENT_TOOL_NAMES.readFile:
      return { label: "Read file", detail: readStringInput(input, "path") };
    case AGENT_TOOL_NAMES.writeFile:
      return { label: "Write file", detail: readStringInput(input, "path") };
    case AGENT_TOOL_NAMES.grep:
      return { label: "Search", detail: readStringInput(input, "query") };
    case AGENT_TOOL_NAMES.glob:
      return { label: "Find files", detail: readStringInput(input, "pattern") };
    case AGENT_TOOL_NAMES.searchReplace:
      return { label: "Edit file", detail: readStringInput(input, "path") };
    case AGENT_TOOL_NAMES.todoWrite:
      return { label: "Update todos" };
    case AGENT_TOOL_NAMES.runCommand:
      return { label: "Run command", detail: readStringInput(input, "command") };
    case AGENT_TOOL_NAMES.taskComplete:
      return { label: "Task complete" };
    case AGENT_TOOL_NAMES.remember:
      return { label: "Remember" };
    default:
      return { label: toolName };
  }
}

async function readOriginalContent(path: string): Promise<string> {
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path });
    return result.content;
  } catch {
    return "";
  }
}

async function dispatchFileEdit(
  call: AgentToolCall,
  rootPath: string,
  decision: AgentApprovalDecision,
): Promise<string> {
  if (call.toolName === AGENT_TOOL_NAMES.writeFile) {
    const path = resolveWorkspacePath(rootPath, readStringInput(call.input, "path"));
    const content = readStringInput(call.input, "content");
    const originalContent = await readOriginalContent(path);
    await applyAgentFileEdit(
      { toolCallId: call.toolCallId, path, originalContent, content },
      decision,
    );
    return `Wrote ${path}`;
  }

  const path = resolveWorkspacePath(rootPath, readStringInput(call.input, "path"));
  const oldString = readStringInput(call.input, "old_string");
  const newString = readStringInput(call.input, "new_string");
  const replaceAll = readBooleanInput(call.input, "replace_all");
  const result = await invoke<FileReadResult>("read_text_file", { path });
  const applied = applySearchReplace(result.content, oldString, newString, replaceAll);
  await applyAgentFileEdit(
    {
      toolCallId: call.toolCallId,
      path,
      originalContent: result.content,
      content: applied.content,
    },
    decision,
  );
  return `Replaced in ${path}`;
}

async function dispatchTool(
  toolName: string,
  input: unknown,
  rootPath: string,
  agentAccess: AgentAccess | null,
): Promise<{ output: string; detail?: string }> {
  switch (toolName) {
    case AGENT_TOOL_NAMES.readFile: {
      const path = resolveWorkspacePath(rootPath, readStringInput(input, "path"));
      const offset = readNumberInput(input, "offset");
      const limit = readNumberInput(input, "limit");
      const result = await invoke<FileReadResult>("read_text_file", { path });
      const slice = sliceFileLines(result.content, offset, limit);
      return { output: truncateOutput(slice.text) };
    }
    case AGENT_TOOL_NAMES.grep: {
      const path = resolveWorkspacePath(rootPath, readStringInput(input, "path") || rootPath);
      const glob = readStringInput(input, "glob");
      const matches = await invoke<SearchMatch[]>("search_workspace", {
        req: {
          workspaceRoot: path,
          query: readStringInput(input, "query"),
          caseSensitive: readBooleanInput(input, "caseSensitive"),
          wholeWord: false,
          useRegex: readBooleanInput(input, "useRegex"),
          includeGlobs: glob ? [glob] : [],
          excludeGlobs: [],
        },
      });
      const limited = matches.slice(0, MAX_SEARCH_MATCHES);
      return {
        output:
          limited.map((m) => `${m.path}:${m.line}:${m.column}: ${m.preview}`).join("\n") ||
          "No matches found.",
        detail: `${matches.length} matches`,
      };
    }
    case AGENT_TOOL_NAMES.glob: {
      const pathInput = readStringInput(input, "path");
      const matches = await invoke<string[]>("glob_workspace", {
        req: {
          workspaceRoot: rootPath,
          pattern: readStringInput(input, "pattern"),
          path: pathInput ? resolveWorkspacePath(rootPath, pathInput) : null,
        },
      });
      return {
        output: matches.join("\n") || "No files found.",
        detail: `${matches.length} files`,
      };
    }
    case AGENT_TOOL_NAMES.todoWrite: {
      const items = readTodoItems(input);
      useAgentStore.getState().setTodos(items, true);
      const count = useAgentStore.getState().todos.length;
      return { output: `Todo list updated (${count} items).` };
    }
    case AGENT_TOOL_NAMES.runCommand: {
      const result = await invoke<AgentCommandResult>("agent_run_command", {
        command: readStringInput(input, "command"),
        cwd: readStringInput(input, "cwd") || null,
        workspaceRoot: rootPath,
        timeoutMs: null,
        approvedRoots: agentAccess?.folders ?? null,
      });
      return {
        output: truncateOutput(
          JSON.stringify(
            {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exit_code,
              timedOut: result.timed_out,
            },
            null,
            2,
          ),
        ),
        detail: `exit ${result.exit_code}${result.timed_out ? " (timed out)" : ""}`,
      };
    }
    case AGENT_TOOL_NAMES.remember: {
      const text = readStringInput(input, "text").trim();
      if (!text) throw new Error("Memory text is required");
      if (!agentAccess) throw new Error("No agent is active for this chat");
      const result = useNamedAgentsStore
        .getState()
        .appendMemory(agentAccess.agentId, text, "agent");
      if (!result.ok) throw new Error(result.error);
      return { output: "Remembered." };
    }
    case AGENT_TOOL_NAMES.taskComplete: {
      const summary = readStringInput(input, "summary");
      useAgentStore.getState().finishTask(summary);
      return { output: "Task marked as complete.", detail: summary || undefined };
    }
    default:
      throw new Error(`Unknown agent tool: ${toolName}`);
  }
}

export async function executeAgentTool(
  call: AgentToolCall,
  rootPath: string,
  agentAccess: AgentAccess | null = null,
): Promise<AgentToolResult> {
  const store = useAgentStore.getState();
  const { label, detail } = stepLabel(call.toolName, call.input);

  const step: AgentStep = {
    id: call.toolCallId,
    toolName: call.toolName,
    label,
    status: "running",
    detail,
  };
  store.addStep(step);

  const finishStep = (status: AgentStep["status"], stepDetail?: string) => {
    useAgentStore.getState().updateStep(call.toolCallId, {
      status,
      ...(stepDetail ? { detail: stepDetail } : {}),
    });
  };

  if (store.status === "cancelled") {
    finishStep("denied");
    return { errorText: "Agent was stopped by the user." };
  }

  if (agentAccess && isFolderScopedTool(call.toolName)) {
    const check = checkAgentToolPath(call.toolName, call.input, rootPath, agentAccess.folders);
    if (!check.approved) {
      finishStep("denied", "Folder is not approved for this agent");
      return { errorText: "Folder is not approved for this agent" };
    }
  }

  const settings = useSettingsStore.getState();
  const writesSkill =
    isFileEditTool(call.toolName) &&
    isSkillPath(resolveWorkspacePath(rootPath, readStringInput(call.input, "path")));
  const decision = writesSkill
    ? "required"
    : resolveAgentApproval(call.toolName, call.input, settings.agent, settings.ai.yoloMode);

  if (isFileEditTool(call.toolName)) {
    try {
      const output = await dispatchFileEdit(call, rootPath, decision);
      finishStep("done", detail);
      if (writesSkill) void useSkillsStore.getState().reloadSkills();
      return { output };
    } catch (err) {
      const errorText = String(err);
      finishStep("error", errorText);
      return { errorText };
    }
  }

  if (decision === "required") {
    const approved = await store.requestApproval({
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.input,
      description: detail,
    });
    if (!approved) {
      finishStep("denied");
      return { errorText: "The user denied this action. Continue without it or finish the task." };
    }
  }

  try {
    const result = await dispatchTool(call.toolName, call.input, rootPath, agentAccess);
    finishStep("done", result.detail ?? detail);
    return { output: result.output };
  } catch (err) {
    const errorText = String(err);
    finishStep("error", errorText);
    return { errorText };
  }
}

// Executes an agent tool call from the chat's onToolCall handler and feeds
// the result back into the chat, mirroring the MCP tool-call path.
export async function executeAgentToolCall(
  chat: UseChatHelpers<UIMessage>,
  rootPath: string,
  toolCall: AgentToolCall,
  agentAccess: AgentAccess | null = null,
): Promise<void> {
  const result = await executeAgentTool(toolCall, rootPath, agentAccess);
  if ("errorText" in result) {
    chat.addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: result.errorText,
    });
  } else {
    chat.addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: result.output,
    });
  }
}
