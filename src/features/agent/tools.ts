import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";

export const AGENT_TOOL_NAMES = {
  readFile: "agent_read_file",
  writeFile: "agent_write_file",
  listFiles: "agent_list_files",
  runCommand: "agent_run_command",
  taskComplete: "agent_task_complete",
} as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[keyof typeof AGENT_TOOL_NAMES];

export const MAX_AGENT_STEPS = 30;

export function isAgentTool(name: string): name is AgentToolName {
  return (Object.values(AGENT_TOOL_NAMES) as string[]).includes(name);
}

export function isDestructiveAgentTool(name: string): boolean {
  return name === AGENT_TOOL_NAMES.writeFile || name === AGENT_TOOL_NAMES.runCommand;
}

export const AGENT_TOOL_DEFINITIONS: BackendToolDefinition[] = [
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.readFile,
      description: "Read the UTF-8 text content of a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path, absolute or relative to the workspace root.",
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
        "Write text content to a file in the workspace, replacing its full content. Creates the file if it does not exist.",
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
      name: AGENT_TOOL_NAMES.listFiles,
      description:
        "List files in a workspace directory, or search file contents when a query is provided.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory to list or search, absolute or relative to the workspace root. Defaults to the workspace root.",
          },
          query: {
            type: "string",
            description: "Optional text to search for in file contents instead of listing files.",
          },
        },
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

export function buildAgentSystemPrompt(rootPath: string): string {
  return [
    "You are running in Agent Mode inside the Pragma IDE. You work autonomously on the user's task until it is done.",
    `The workspace root is: ${rootPath}`,
    "Use the agent tools to inspect files, edit code and run shell commands. Prefer small, verifiable steps: read before you write, and run builds or tests to verify your changes.",
    "Paths may be absolute or relative to the workspace root.",
    `Do not stop early and do not ask questions. When the task is completely finished and verified, call ${AGENT_TOOL_NAMES.taskComplete} with a summary.`,
  ].join("\n");
}
