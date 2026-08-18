export const BRIDGE_REQUEST_TIMEOUT_MS = 5000;

const BOOTSTRAP_SCRIPT = String.raw`
(() => {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const TIMEOUT_MS = __TIMEOUT_MS__;

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        if (pending.delete(id)) {
          reject(new Error("Request timed out: " + method));
        }
      }, TIMEOUT_MS);
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
    editor: {
      getActiveFile: () => request("editor.getActiveFile"),
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
  const bootstrap = BOOTSTRAP_SCRIPT.replace("__TIMEOUT_MS__", String(BRIDGE_REQUEST_TIMEOUT_MS));
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"></head><body>',
    `<script>${bootstrap}</script>`,
    `<script>${escapeInlineScript(mainSource)}</script>`,
    "</body></html>",
  ].join("\n");
}
