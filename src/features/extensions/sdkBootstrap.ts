export const BRIDGE_REQUEST_TIMEOUT_MS = 5000;
// Writing to a new terminal waits for its shell to start.
export const TERMINAL_REQUEST_TIMEOUT_MS = 15000;

const BOOTSTRAP_SCRIPT = String.raw`
(() => {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const handlers = new Map();
  let nextProviderId = 1;
  const TIMEOUT_MS = __TIMEOUT_MS__;
  const TERMINAL_TIMEOUT_MS = __TERMINAL_TIMEOUT_MS__;

  function request(method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        if (pending.delete(id)) {
          reject(new Error("Request timed out: " + method));
        }
      }, timeoutMs || TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      window.parent.postMessage({ kind: "request", id, method, params }, "*");
    });
  }

  function subscribe(event, fn) {
    let subs = listeners.get(event);
    if (!subs) {
      subs = new Set();
      listeners.set(event, subs);
    }
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }

  const CALL_HANDLERS = {
    "diagnostics.provide": (params) => ["diagnostics:" + params.providerId, [params.document]],
    "completion.provide": (params) => [
      "completion:" + params.providerId,
      [{
        document: params.document,
        line: params.line,
        column: params.column,
        prefix: params.prefix,
        triggerCharacter: params.triggerCharacter,
      }],
    ],
    "tool.call": (params) => ["tool:" + params.name, [params.input]],
  };

  async function handleCall(msg) {
    const reply = (message) => {
      try {
        window.parent.postMessage(message, "*");
      } catch (err) {
        window.parent.postMessage({ kind: "result", id: msg.id, ok: false, error: String(err) }, "*");
      }
    };
    try {
      const route = CALL_HANDLERS[msg.method];
      if (!route) throw new Error("Unknown call: " + msg.method);
      const [key, args] = route(msg.params || {});
      const handler = handlers.get(key);
      if (!handler) throw new Error("No handler registered for " + key);
      const result = await handler(...args);
      reply({ kind: "result", id: msg.id, ok: true, result: result === undefined ? null : result });
    } catch (err) {
      reply({ kind: "result", id: msg.id, ok: false, error: err && err.message ? err.message : String(err) });
    }
  }

  async function registerHandler(key, handler, method, params) {
    if (typeof handler !== "function") throw new Error("handler must be a function");
    handlers.set(key, handler);
    try {
      await request(method, params);
    } catch (err) {
      handlers.delete(key);
      throw err;
    }
  }

  async function registerProvider(kind, method, language, provider, extra) {
    const id = kind + "-" + nextProviderId++;
    const key = kind + ":" + id;
    await registerHandler(key, provider, method, Object.assign({ id, language }, extra));
    return () => {
      handlers.delete(key);
      return request("languages.unregisterProvider", { id });
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.kind === "response") {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.ok) {
        entry.resolve(msg.result);
      } else {
        entry.reject(new Error(typeof msg.error === "string" ? msg.error : "Request failed"));
      }
    } else if (msg.kind === "call") {
      handleCall(msg);
    } else if (msg.kind === "event") {
      const subs = listeners.get(msg.event);
      if (!subs) return;
      for (const fn of subs) {
        try {
          fn(msg.data);
        } catch (err) {
          console.error("[pragma] event handler failed:", err);
        }
      }
    }
  });

  window.pragma = {
    commands: {
      register: (command) => request("commands.register", command),
      unregister: (id) => request("commands.unregister", { id }),
    },
    themes: {
      register: (theme) => request("themes.register", theme),
    },
    panels: {
      register: (panel) => request("panels.register", panel),
    },
    settings: {
      get: () => request("settings.get"),
      set: (value) => request("settings.set", { value }),
    },
    notifications: {
      show: (message, type) => request("notifications.show", { message, type }),
    },
    workspace: {
      readFile: (path) => request("workspace.readFile", { path }),
      writeFile: (path, content) => request("workspace.writeFile", { path, content }),
      list: (path) => request("workspace.list", path === undefined ? {} : { path }),
    },
    editor: {
      getActiveFile: () => request("editor.getActiveFile"),
      getText: () => request("editor.getText"),
      setText: (text) => request("editor.setText", { text }),
      getSelection: () => request("editor.getSelection"),
    },
    statusBar: {
      set: (item) => request("statusBar.set", item),
      remove: (id) => request("statusBar.remove", { id }),
    },
    keybindings: {
      register: (binding) => request("keybindings.register", binding),
      unregister: (command) => request("keybindings.unregister", { command }),
    },
    languages: {
      registerDiagnosticsProvider: (language, provider) =>
        registerProvider("diagnostics", "languages.registerDiagnosticsProvider", language, provider, {}),
      registerCompletionProvider: (language, provider, options) =>
        registerProvider("completion", "languages.registerCompletionProvider", language, provider, {
          triggerCharacters: (options && options.triggerCharacters) || [],
        }),
    },
    agent: {
      registerTool: (tool, handler) =>
        registerHandler("tool:" + (tool && tool.name), handler, "agent.registerTool", {
          name: tool && tool.name,
          description: tool && tool.description,
          inputSchema: tool && tool.inputSchema,
          readOnly: Boolean(tool && tool.readOnly),
        }),
      unregisterTool: (name) => {
        handlers.delete("tool:" + name);
        return request("agent.unregisterTool", { name });
      },
    },
    terminal: {
      create: (options) => request("terminal.create", options || {}),
      sendText: (id, text, addNewLine) =>
        request("terminal.sendText", { id, text, addNewLine: addNewLine !== false }, TERMINAL_TIMEOUT_MS),
    },
    onCommand: (fn) => subscribe("command", fn),
    on: (event, fn) => subscribe(event, fn),
  };
})();
`;

function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

export function buildExtensionSrcDoc(mainSource: string): string {
  const bootstrap = BOOTSTRAP_SCRIPT.replace(
    "__TIMEOUT_MS__",
    String(BRIDGE_REQUEST_TIMEOUT_MS),
  ).replace("__TERMINAL_TIMEOUT_MS__", String(TERMINAL_REQUEST_TIMEOUT_MS));
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"></head><body>',
    `<script>${bootstrap}</script>`,
    `<script>${escapeInlineScript(mainSource)}</script>`,
    "</body></html>",
  ].join("\n");
}
