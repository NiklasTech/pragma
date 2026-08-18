import { invoke } from "@tauri-apps/api/core";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { useSettingsStore } from "@/shared/stores/settings";

import { useAgentStore, type AgentStep } from "./store";
import { resolveAgentApproval } from "./permissions";
import { AGENT_TOOL_NAMES } from "./tools";

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

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
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
const MAX_LIST_ENTRIES = 500;
const MAX_SEARCH_MATCHES = 100;

function readStringInput(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
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

function stepLabel(toolName: string, input: unknown): { label: string; detail?: string } {
  switch (toolName) {
    case AGENT_TOOL_NAMES.readFile:
      return { label: "Read file", detail: readStringInput(input, "path") };
    case AGENT_TOOL_NAMES.writeFile:
      return { label: "Write file", detail: readStringInput(input, "path") };
    case AGENT_TOOL_NAMES.listFiles: {
      const query = readStringInput(input, "query");
      return query
        ? { label: "Search files", detail: query }
        : { label: "List files", detail: readStringInput(input, "path") || undefined };
    }
    case AGENT_TOOL_NAMES.runCommand:
      return { label: "Run command", detail: readStringInput(input, "command") };
    case AGENT_TOOL_NAMES.taskComplete:
      return { label: "Task complete" };
    default:
      return { label: toolName };
  }
}

async function checkpointBeforeWrite(path: string): Promise<void> {
  const store = useAgentStore.getState();
  if (store.checkpointedPaths.includes(path)) return;
  try {
    await invoke("local_history_snapshot", { filePath: path });
  } catch {
    // Checkpointing is best-effort; the write itself must not fail because of it.
  }
  store.markCheckpointed(path);
}

async function dispatchTool(
  toolName: string,
  input: unknown,
  rootPath: string,
): Promise<{ output: string; detail?: string }> {
  switch (toolName) {
    case AGENT_TOOL_NAMES.readFile: {
      const path = resolveWorkspacePath(rootPath, readStringInput(input, "path"));
      const result = await invoke<FileReadResult>("read_text_file", { path });
      return { output: truncateOutput(result.content) };
    }
    case AGENT_TOOL_NAMES.writeFile: {
      const path = resolveWorkspacePath(rootPath, readStringInput(input, "path"));
      await checkpointBeforeWrite(path);
      await invoke("write_text_file", { path, content: readStringInput(input, "content") });
      return { output: `Wrote ${path}` };
    }
    case AGENT_TOOL_NAMES.listFiles: {
      const path = resolveWorkspacePath(rootPath, readStringInput(input, "path") || rootPath);
      const query = readStringInput(input, "query");
      if (query) {
        const matches = await invoke<SearchMatch[]>("search_workspace", {
          req: {
            workspaceRoot: path,
            query,
            caseSensitive: false,
            wholeWord: false,
            useRegex: false,
            includeGlobs: [],
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
      const entries = await invoke<DirEntry[]>("list_directory_recursive", { path });
      const limited = entries.slice(0, MAX_LIST_ENTRIES);
      return {
        output:
          limited.map((e) => `${e.path}${e.is_directory ? "/" : ""}`).join("\n") ||
          "Directory is empty.",
        detail: `${entries.length} entries`,
      };
    }
    case AGENT_TOOL_NAMES.runCommand: {
      const result = await invoke<AgentCommandResult>("agent_run_command", {
        command: readStringInput(input, "command"),
        cwd: readStringInput(input, "cwd") || null,
        workspaceRoot: rootPath,
        timeoutMs: null,
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

  const settings = useSettingsStore.getState();
  const decision = resolveAgentApproval(
    call.toolName,
    call.input,
    settings.agent,
    settings.ai.yoloMode,
  );

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
    const result = await dispatchTool(call.toolName, call.input, rootPath);
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
): Promise<void> {
  const result = await executeAgentTool(toolCall, rootPath);
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
