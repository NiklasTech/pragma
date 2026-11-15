// Stdio MCP server for coding agents: drives a running Pragma Dev (`pnpm run dev:desktop`)
// through the dev bridge that only debug builds serve (src-tauri/src/modules/dev_bridge).
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const DEV_CONFIG = new URL("../src-tauri/tauri.dev.conf.json", import.meta.url);
const IDENTIFIER = JSON.parse(readFileSync(DEV_CONFIG, "utf8")).identifier;
const DISCOVERY_FILE = "dev-bridge.json";
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const REPLY_TIMEOUT_MS = 4 * 60 * 1000;
const NOT_RUNNING =
  "Pragma Dev is not running. Start it with `pnpm run dev:desktop` as a background command, wait until it prints that the app is running, then call pragma_status.";

const windowProp = {
  window: {
    type: "string",
    description: "Window label from pragma_status. Defaults to the focused window, else main.",
  },
};
const targetProps = {
  ref: { type: "string", description: "Element ref like e12 from the last pragma_inspect." },
  selector: { type: "string", description: "CSS selector of the element." },
  x: { type: "number", description: "Viewport x in CSS pixels, with y instead of a ref." },
  y: { type: "number", description: "Viewport y in CSS pixels." },
};
const textTargetProp = {
  type: "string",
  description: "Visible name of an interactive element, matched exactly, then as substring.",
};
const waitProp = {
  wait_ms: {
    type: "number",
    description: "Time to let the UI settle afterwards. Defaults to 150.",
  },
};

const TOOLS = [
  {
    name: "pragma_status",
    description:
      "Check whether Pragma Dev (the debug build of this repo) is running and list its windows. Start it first with `pnpm run dev:desktop` in the background.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "pragma_inspect",
    description:
      "Outline of the visible UI of a Pragma Dev window: interactive elements with refs [eN], headings, dialogs, menus and text. Use the refs with pragma_click, pragma_type and pragma_press.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        selector: { type: "string", description: "Only outline this subtree." },
        max_lines: { type: "number", description: "Line limit, 20 to 3000. Defaults to 400." },
      },
    },
  },
  {
    name: "pragma_click",
    description:
      "Click an element in Pragma Dev with real pointer and mouse events. Target it by ref, selector, text or coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        ...targetProps,
        text: textTargetProp,
        button: { type: "string", enum: ["left", "right", "middle"] },
        double: { type: "boolean", description: "Double-click." },
        modifiers: {
          type: "array",
          items: { type: "string", enum: ["Mod", "Meta", "Ctrl", "Alt", "Shift"] },
          description: "Held keys. Mod is Cmd on macOS and Ctrl elsewhere.",
        },
        ...waitProp,
      },
    },
  },
  {
    name: "pragma_type",
    description:
      "Type text into an input, the code editor or a terminal of Pragma Dev. Without a target it types into the focused element. Use pragma_press for Enter and shortcuts.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        ...targetProps,
        target_text: textTargetProp,
        text: { type: "string", description: "The text to insert." },
        clear: { type: "boolean", description: "Replace the current content." },
        submit: { type: "boolean", description: "Press Enter afterwards." },
        ...waitProp,
      },
      required: ["text"],
    },
  },
  {
    name: "pragma_press",
    description:
      "Press a key or shortcut in Pragma Dev, like Enter, Escape, ArrowDown, Mod+P or Mod+Shift+F. Goes to the target or the focused element.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        ...targetProps,
        text: textTargetProp,
        key: { type: "string", description: "Key with optional modifiers joined by +." },
        ...waitProp,
      },
      required: ["key"],
    },
  },
  {
    name: "pragma_wait_for",
    description: "Wait until text or a selector appears in Pragma Dev, or disappears with gone.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        text: { type: "string" },
        selector: { type: "string" },
        gone: { type: "boolean" },
        timeout_ms: { type: "number", description: "Defaults to 5000, at most 120000." },
      },
    },
  },
  {
    name: "pragma_screenshot",
    description: "Screenshot of a Pragma Dev window's web content as PNG.",
    inputSchema: { type: "object", properties: { ...windowProp } },
  },
  {
    name: "pragma_console_logs",
    description:
      "Console messages, uncaught errors and unhandled rejections of a Pragma Dev window since its page loaded.",
    inputSchema: {
      type: "object",
      properties: {
        ...windowProp,
        limit: { type: "number", description: "Most recent entries. Defaults to 50." },
        level: {
          type: "array",
          items: { type: "string", enum: ["log", "info", "warn", "error", "debug"] },
        },
        clear: { type: "boolean", description: "Clear the buffer after reading." },
      },
    },
  },
  {
    name: "pragma_backend_logs",
    description: "Last lines of the Rust backend log file of Pragma Dev.",
    inputSchema: {
      type: "object",
      properties: { lines: { type: "number", description: "Defaults to 100." } },
    },
  },
  {
    name: "pragma_eval",
    description:
      "Run JavaScript in a Pragma Dev window as the body of an async function and return the result (use return). Strings come back as they are, other values as JSON.",
    inputSchema: {
      type: "object",
      properties: { ...windowProp, script: { type: "string" } },
      required: ["script"],
    },
  },
  {
    name: "pragma_menu",
    description:
      "List the native macOS menu bar items of Pragma Dev, or trigger one by id like a click.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Menu item id; omit to list them." } },
    },
  },
];

function dataDir() {
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support");
  }
  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming");
  }
  return process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
}

async function readDiscovery() {
  try {
    return JSON.parse(await readFile(path.join(dataDir(), IDENTIFIER, DISCOVERY_FILE), "utf8"));
  } catch {
    throw new Error(NOT_RUNNING);
  }
}

/** Sends one action to the app and resolves with its `{ ok, text, image? }` reply. */
async function send(action, window, args) {
  const bridge = await readDiscovery();
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: bridge.port });
    let buffer = "";
    let settled = false;
    const finish = (error, reply) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(reply);
    };
    socket.setEncoding("utf8");
    socket.setTimeout(REPLY_TIMEOUT_MS, () =>
      finish(new Error("Pragma Dev did not answer in time")),
    );
    socket.on("connect", () => {
      socket.write(`${JSON.stringify({ token: bridge.token, action, window, args })}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        finish(null, JSON.parse(buffer.slice(0, end)));
      } catch (error) {
        finish(error);
      }
    });
    socket.on("error", (error) =>
      finish(error.code === "ECONNREFUSED" ? new Error(NOT_RUNNING) : error),
    );
    socket.on("close", () => finish(new Error("Pragma Dev closed the connection")));
  });
}

async function callTool(name, rawArgs) {
  if (!TOOLS.some((tool) => tool.name === name)) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  const { window, ...args } = rawArgs ?? {};
  try {
    const reply = await send(name.slice("pragma_".length), window, args);
    const content = [{ type: "text", text: reply.text }];
    if (reply.image) content.push({ type: "image", data: reply.image, mimeType: "image/png" });
    return { content, isError: !reply.ok };
  } catch (error) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  }
}

async function handle(message) {
  const { id, method, params } = message;
  if (id === undefined || id === null) return null;
  switch (method) {
    case "initialize":
      return {
        protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "pragma-dev", version: "1.0.0" },
        instructions:
          "Drives Pragma Dev, the debug build of this repository. Start it with `pnpm run dev:desktop` in the background, then use pragma_status, pragma_inspect, pragma_click, pragma_type, pragma_press, pragma_screenshot and the log tools. Never use these tools on the installed Pragma app; they only reach the dev build.",
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return callTool(params?.name, params?.arguments);
    default:
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

const write = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${error.message}` },
    });
    return;
  }
  handle(message).then(
    (result) => {
      if (result !== null) write({ jsonrpc: "2.0", id: message.id, result });
    },
    (error) => {
      write({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: error.code ?? -32603, message: error.message },
      });
    },
  );
});
