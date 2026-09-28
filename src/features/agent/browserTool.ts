import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";

import { AGENT_TOOL_NAMES } from "./tools";

export const OPEN_BROWSER_TOOL_DEFINITION: BackendToolDefinition = {
  type: "function",
  function: {
    name: AGENT_TOOL_NAMES.openBrowser,
    description:
      "Show an http or https URL to the user in Pragma's browser pane, for example the local dev server after starting it. It navigates the open browser pane or opens one. It does not return the page content; fetch the URL with a command to read it.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The http or https URL to open, e.g. http://localhost:5173.",
        },
      },
      required: ["url"],
    },
  },
};
