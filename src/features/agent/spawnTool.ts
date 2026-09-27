import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";

import { AGENT_TOOL_NAMES } from "./tools";

export const SPAWN_SESSION_TOOL_DEFINITION: BackendToolDefinition = {
  type: "function",
  function: {
    name: AGENT_TOOL_NAMES.spawnSession,
    description:
      "Start a child session that works on its own task. The child runs separately; this session does not wait for it and is not finished when the child is. The user must approve the start.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title of the child session, 1 to 80 characters.",
        },
        prompt: { type: "string", description: "The first user message of the child session." },
        kind: {
          type: "string",
          enum: ["conversation", "terminal"],
          description:
            "Conversation runs Pragma's agent. Terminal runs a coding CLI. Defaults to conversation.",
        },
        environment: {
          type: "string",
          enum: ["checkout", "worktree"],
          description:
            "Worktree gives the child its own new git worktree. Defaults to worktree for a writing session.",
        },
        cli: {
          type: "string",
          description: "Id of an installed coding CLI. Required when kind is terminal.",
        },
      },
      required: ["title", "prompt"],
    },
  },
};
