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

export const BROWSER_SCREENSHOT_TOOL_DEFINITION: BackendToolDefinition = {
  type: "function",
  function: {
    name: AGENT_TOOL_NAMES.browserScreenshot,
    description: `Take a screenshot of the page in Pragma's browser pane and return it as an image, for example to check a UI change. Open the page with ${AGENT_TOOL_NAMES.openBrowser} first; the screenshot waits until it has loaded. Only models that accept images can see the result.`,
    parameters: { type: "object", properties: {} },
  },
};

export const BROWSER_CONSOLE_TOOL_DEFINITION: BackendToolDefinition = {
  type: "function",
  function: {
    name: AGENT_TOOL_NAMES.browserConsole,
    description: `Read the recent console messages, uncaught errors and failed requests of the page in Pragma's browser pane. Entries are kept from the last load of the page; open or reload it with ${AGENT_TOOL_NAMES.openBrowser}.`,
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of recent entries to return, 1 to 200. Defaults to 50.",
        },
      },
    },
  },
};

export const BROWSER_TOOL_DEFINITIONS: BackendToolDefinition[] = [
  OPEN_BROWSER_TOOL_DEFINITION,
  BROWSER_SCREENSHOT_TOOL_DEFINITION,
  BROWSER_CONSOLE_TOOL_DEFINITION,
];
