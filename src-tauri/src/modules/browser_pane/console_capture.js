// Records console output, uncaught errors and failed requests of a page in the browser pane.
// It runs in every frame but only activates in direct child frames of the app.
(() => {
  if (window === window.top || window.parent !== window.top) return;
  const APP_ORIGINS = __PRAGMA_APP_ORIGINS__;
  // A native browser pane shows a remote page on top; its frames must not report to it.
  const ancestors = location.ancestorOrigins;
  if (ancestors && ancestors.length > 0 && !APP_ORIGINS.includes(ancestors[0])) return;

  const MAX_ENTRIES = 200;
  const MAX_TEXT = 2000;
  const entries = [];

  const format = (value) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  };

  const push = (level, text) => {
    const clipped = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}...` : text;
    entries.push({ level, text: clipped, time: Date.now() });
    if (entries.length > MAX_ENTRIES) entries.shift();
  };

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level];
    console[level] = function (...args) {
      push(level, args.map(format).join(" "));
      return original.apply(this, args);
    };
  }

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (target instanceof Element) {
        const source = target.getAttribute("src") || target.getAttribute("href") || "";
        push("network", `Failed to load ${target.tagName.toLowerCase()} ${source}`);
        return;
      }
      push(
        "error",
        event.error
          ? format(event.error)
          : `${event.message} (${event.filename}:${event.lineno}:${event.colno})`,
      );
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) => {
    push("error", `Unhandled rejection: ${format(event.reason)}`);
  });

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init && init.method) || (input instanceof Request && input.method) || "GET";
      return originalFetch.call(this, input, init).then(
        (response) => {
          if (!response.ok) push("network", `${response.status} ${method} ${url}`);
          return response;
        },
        (error) => {
          push("network", `Failed ${method} ${url}: ${format(error)}`);
          throw error;
        },
      );
    };
  }

  window.XMLHttpRequest = class extends window.XMLHttpRequest {
    open(method, url, ...rest) {
      this.addEventListener("load", () => {
        if (this.status >= 400) push("network", `${this.status} ${method} ${url}`);
      });
      this.addEventListener("error", () => push("network", `Failed ${method} ${url}`));
      return super.open(method, url, ...rest);
    }
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !APP_ORIGINS.includes(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== "pragma:browser-console") return;
    window.parent.postMessage(
      {
        type: "pragma:browser-console-result",
        id: data.id,
        url: location.href,
        entries: entries.slice(),
      },
      "*",
    );
  });
})();
