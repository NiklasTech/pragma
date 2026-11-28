// Records console output, uncaught errors and failed requests of a page in the browser pane, and
// reads, clicks and types for agents. It runs in every frame but only activates in direct child
// frames of the app, and only the app may ask it.
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

  const MAX_READ = 40000;
  const MAX_LABEL = 80;
  const CONTROLS =
    "a[href], button, input, textarea, select, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [contenteditable=true]";

  const shown = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const labelOf = (element) =>
    (
      element.getAttribute("aria-label") ||
      element.innerText ||
      element.value ||
      element.getAttribute("placeholder") ||
      element.getAttribute("title") ||
      element.getAttribute("name") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  const describe = (element) => {
    const label = labelOf(element).slice(0, MAX_LABEL);
    const id = element.id ? `#${element.id}` : "";
    return `${element.tagName.toLowerCase()}${id}${label ? ` "${label}"` : ""}`;
  };
  // A selector wins; else the shown control whose label is the text, then one that contains it.
  const findTarget = (selector, text) => {
    if (selector) return document.querySelector(selector);
    const wanted = (text || "").trim().toLowerCase();
    if (!wanted) return null;
    const controls = [...document.querySelectorAll(CONTROLS)].filter(shown);
    return (
      controls.find((element) => labelOf(element).toLowerCase() === wanted) ||
      controls.find((element) => labelOf(element).toLowerCase().includes(wanted)) ||
      null
    );
  };
  const setValue = (element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    // Frameworks like React track the value through the prototype's setter.
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const actions = {
    read: () => {
      const controls = [...document.querySelectorAll(CONTROLS)]
        .filter(shown)
        .slice(0, 100)
        .map((element) => `- ${describe(element)}`);
      const text = (document.body ? document.body.innerText : "").slice(0, MAX_READ);
      return `${document.title}\n${location.href}\n\n${text}\n\nControls:\n${controls.join("\n")}`;
    },
    click: ({ selector, text }) => {
      const target = findTarget(selector, text);
      if (!target) throw new Error(`No shown control matches ${selector || `"${text}"`}`);
      target.scrollIntoView({ block: "center" });
      target.click();
      return `Clicked ${describe(target)}`;
    },
    type: ({ selector, text, value, submit }) => {
      const target = findTarget(selector, text);
      if (!target) throw new Error(`No shown field matches ${selector || `"${text}"`}`);
      target.focus();
      if (target.isContentEditable) {
        target.textContent = value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        setValue(target, value);
      }
      if (submit) {
        const enter = { key: "Enter", code: "Enter", bubbles: true };
        target.dispatchEvent(new KeyboardEvent("keydown", enter));
        if (target.form) target.form.requestSubmit();
        target.dispatchEvent(new KeyboardEvent("keyup", enter));
      }
      return `Typed into ${describe(target)}${submit ? " and submitted" : ""}`;
    },
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !APP_ORIGINS.includes(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== "pragma:browser-action") return;
    const reply = { type: "pragma:browser-action-result", id: data.id };
    try {
      const action = actions[data.action];
      if (!action) throw new Error(`Unknown browser action ${data.action}`);
      window.parent.postMessage({ ...reply, ok: true, text: action(data.args || {}) }, "*");
    } catch (error) {
      window.parent.postMessage({ ...reply, ok: false, text: String(error.message || error) }, "*");
    }
  });
})();
