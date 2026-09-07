import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";

import { formatRulesForPrompt, type ProjectRules } from "./rules";

export const AGENT_TOOL_NAMES = {
  readFile: "agent_read_file",
  writeFile: "agent_write_file",
  grep: "agent_grep",
  glob: "agent_glob",
  searchReplace: "agent_search_replace",
  todoWrite: "agent_todo_write",
  runCommand: "agent_run_command",
  taskComplete: "agent_task_complete",
} as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[keyof typeof AGENT_TOOL_NAMES];

export const MAX_AGENT_STEPS = 30;

export function isAgentTool(name: string): name is AgentToolName {
  return (Object.values(AGENT_TOOL_NAMES) as string[]).includes(name);
}

export function isDestructiveAgentTool(name: string): boolean {
  return (
    name === AGENT_TOOL_NAMES.writeFile ||
    name === AGENT_TOOL_NAMES.searchReplace ||
    name === AGENT_TOOL_NAMES.runCommand
  );
}

export function isFileEditTool(name: string): boolean {
  return name === AGENT_TOOL_NAMES.writeFile || name === AGENT_TOOL_NAMES.searchReplace;
}

export const AGENT_TOOL_DEFINITIONS: BackendToolDefinition[] = [
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.readFile,
      description:
        "Read the UTF-8 text content of a file in the workspace. Use offset and limit to read only a slice of large files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path, absolute or relative to the workspace root.",
          },
          offset: {
            type: "number",
            description: "Optional 1-based line number to start reading from. Defaults to 1.",
          },
          limit: {
            type: "number",
            description: "Optional maximum number of lines to read. Defaults to the whole file.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.writeFile,
      description:
        "Write a new file, or replace a file's full content when a search-replace patch cannot apply. Prefer agent_search_replace for edits to existing files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path, absolute or relative to the workspace root.",
          },
          content: { type: "string", description: "The complete new file content." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.grep,
      description:
        "Search file contents in the workspace for a text or regular expression query and return matching lines with paths.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text or regular expression to search for." },
          path: {
            type: "string",
            description:
              "Directory to search, absolute or relative to the workspace root. Defaults to the workspace root.",
          },
          glob: {
            type: "string",
            description: "Optional glob pattern to limit which files are searched.",
          },
          caseSensitive: {
            type: "boolean",
            description: "Whether the search is case-sensitive. Defaults to false.",
          },
          useRegex: {
            type: "boolean",
            description: "Whether query is a regular expression. Defaults to false.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.glob,
      description: "Find files in the workspace whose paths match a glob pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern, e.g. '**/*.ts' or 'src/**'." },
          path: {
            type: "string",
            description:
              "Directory to search, absolute or relative to the workspace root. Defaults to the workspace root.",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.searchReplace,
      description:
        "Replace an exact string in a file with a new string. This is the default way to edit existing files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path, absolute or relative to the workspace root.",
          },
          old_string: { type: "string", description: "The exact text to replace." },
          new_string: { type: "string", description: "The replacement text." },
          replace_all: {
            type: "boolean",
            description:
              "Replace every occurrence. When false, old_string must match exactly once. Defaults to false.",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.todoWrite,
      description: "Create or update the task's todo list. Items are merged by id.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Stable identifier for this todo item." },
                content: { type: "string", description: "What the item is." },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "done"],
                },
              },
              required: ["id", "content", "status"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.runCommand,
      description:
        "Run a shell command inside the workspace and return stdout, stderr and the exit code. Use for builds, tests and package scripts.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute." },
          cwd: {
            type: "string",
            description:
              "Working directory, absolute or relative to the workspace root. Defaults to the workspace root.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.taskComplete,
      description:
        "Signal that the task is fully done. Call this only after all changes are made and verified.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Short summary of what was accomplished." },
        },
        required: ["summary"],
      },
    },
  },
];

export function buildAgentSystemPrompt(rootPath: string, rules?: ProjectRules | null): string {
  const lines = [
    "You are running in Agent Mode inside the Pragma IDE. You work autonomously on the user's task until it is done.",
    `The workspace root is: ${rootPath}`,
    "Use the agent tools to inspect files, edit code and run shell commands. Prefer small, verifiable steps: read before you write, and run builds or tests to verify your changes.",
    "Edit existing files with agent_search_replace. Use agent_grep and agent_glob to locate code, and agent_read_file with offset/limit to read large files without dumping them fully.",
    `Keep your todo list updated with ${AGENT_TOOL_NAMES.todoWrite} as you plan and complete work.`,
    "Paths may be absolute or relative to the workspace root.",
    `Do not stop early and do not ask questions. When the task is completely finished and verified, call ${AGENT_TOOL_NAMES.taskComplete} with a summary.`,
  ];

  const rulesBlock = formatRulesForPrompt(rules ?? null);
  if (rulesBlock) {
    lines.push("", rulesBlock);
  }

  return lines.join("\n");
}
