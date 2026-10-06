import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";

import { AGENT_TOOL_NAMES } from "./tools";

const PATH_PROPERTY = {
  type: "string",
  description: "File path, absolute or relative to the workspace root.",
};

const POSITION_PROPERTIES = {
  path: PATH_PROPERTY,
  line: { type: "number", description: "1-based line number where the symbol appears." },
  symbol: {
    type: "string",
    description: "The identifier on that line, e.g. a function or variable name.",
  },
};

export const INSIGHT_TOOL_DEFINITIONS: BackendToolDefinition[] = [
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.listDir,
      description:
        "List the entries of one directory with their type and size. Entries ignored by .gitignore are left out.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory, absolute or relative to the workspace root. Defaults to the workspace root.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.getDiagnostics,
      description:
        "Get the errors and warnings shown in the Problems panel, for one file or the whole workspace. Language server diagnostics cover files open in the editor; run the project's type checker or linter to check other files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Optional file path, absolute or relative to the workspace root. Omit for the whole workspace.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.findDefinition,
      description: "Find where a symbol is defined, using the language server.",
      parameters: {
        type: "object",
        properties: POSITION_PROPERTIES,
        required: ["path", "line", "symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.findReferences,
      description:
        "Find all references to a symbol across the workspace, using the language server.",
      parameters: {
        type: "object",
        properties: POSITION_PROPERTIES,
        required: ["path", "line", "symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.workspaceSymbols,
      description:
        "Search the workspace for classes, functions, types and other symbols by name, using the language server.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Symbol name or part of it." },
          path: {
            type: "string",
            description:
              "Any file in the language to search, absolute or relative to the workspace root. It selects the language server.",
          },
        },
        required: ["query", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: AGENT_TOOL_NAMES.webFetch,
      description:
        "Fetch an http or https URL and return its content as readable text, e.g. documentation pages. The user must approve each fetch.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The http or https URL to fetch." },
        },
        required: ["url"],
      },
    },
  },
];
