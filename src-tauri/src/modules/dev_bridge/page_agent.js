// Pragma Dev only: lets the dev bridge inspect and drive the app page for coding agents.
(() => {
  if (window.top !== window || window.__pragmaDevBridge) return;
  if (!__PRAGMA_APP_ORIGINS__.includes(window.location.origin)) return;

  const MAX_LOG_ENTRIES = 1000;
  const MAX_RESULTS = 100;
  const MAX_RESULT_CHARS = 60000;
  const MAX_NAME_CHARS = 120;
  const DEFAULT_SETTLE_MS = 150;
  const logs = [];
  const results = new Map();
  let refs = new Map();
  let nextRef = 1;

  const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}...` : text);
  const collapse = (text) => (text ?? "").replace(/\s+/g, " ").trim();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const describeValue = (value) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value}${value.stack ? `\n${value.stack}` : ""}`;
    if (value === undefined) return "undefined";
    if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
    if (value instanceof Element) return describeElement(value);
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  };

  // Console capture
  const record = (level, values) => {
    const now = new Date();
    const time = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const text = truncate(values.map(describeValue).join(" "), 4000);
    logs.push({ time, level, text });
    if (logs.length > MAX_LOG_ENTRIES) logs.shift();
  };
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      record(level, values);
      original(...values);
    };
  }
  window.addEventListener("error", (event) =>
    record("error", [event.error ?? `${event.message} (${event.filename}:${event.lineno})`]),
  );
  window.addEventListener("unhandledrejection", (event) =>
    record("error", ["Unhandled rejection:", event.reason]),
  );

  // Element description
  const INTERACTIVE_ROLES = new Set([
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "checkbox",
    "radio",
    "switch",
    "option",
    "treeitem",
    "combobox",
    "textbox",
    "searchbox",
    "slider",
    "spinbutton",
  ]);
  const CONTAINER_ROLES = new Set([
    "dialog",
    "alertdialog",
    "menu",
    "menubar",
    "listbox",
    "tablist",
    "tabpanel",
    "tree",
    "toolbar",
    "navigation",
    "tooltip",
    "alert",
    "status",
  ]);
  const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

  const roleOf = (el) => {
    const role = el.getAttribute("role");
    if (role) return role;
    const tag = el.tagName.toLowerCase();
    if (el.classList.contains("xterm")) return "terminal";
    if (el.classList.contains("cm-editor")) return "editor";
    if (tag === "a") return "link";
    if (tag === "input") {
      const type = el.getAttribute("type") ?? "text";
      if (type === "checkbox" || type === "radio") return type;
      if (type === "button" || type === "submit" || type === "reset") return "button";
      return "textbox";
    }
    if (tag === "textarea" || el.isContentEditable) return "textbox";
    if (tag === "select") return "combobox";
    if (/^h[1-6]$/.test(tag)) return `heading${tag[1]}`;
    return tag;
  };

  const nameOf = (el) => {
    const label = el.getAttribute("aria-label");
    if (label) return collapse(label);
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = collapse(
        labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" "),
      );
      if (text) return text;
    }
    if (el.matches("input, textarea, select")) {
      const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      return collapse(
        label?.textContent || el.getAttribute("placeholder") || el.getAttribute("name") || "",
      );
    }
    if (el.classList.contains("xterm")) return "";
    if (el.classList.contains("cm-editor")) {
      return collapse(el.querySelector(".cm-content")?.innerText);
    }
    const text = collapse(el.innerText ?? el.textContent);
    if (text) return text;
    return collapse(
      el.getAttribute("title") ||
        el.querySelector("[aria-label]")?.getAttribute("aria-label") ||
        el.querySelector("img[alt]")?.getAttribute("alt") ||
        "",
    );
  };

  const flagsOf = (el) => {
    const flags = [];
    if (el.disabled || el.getAttribute("aria-disabled") === "true") flags.push("disabled");
    if (el.checked || el.getAttribute("aria-checked") === "true") flags.push("checked");
    if (el.getAttribute("aria-selected") === "true") flags.push("selected");
    if (el.getAttribute("aria-pressed") === "true") flags.push("pressed");
    if (el.getAttribute("aria-current") && el.getAttribute("aria-current") !== "false") {
      flags.push("current");
    }
    const expanded = el.getAttribute("aria-expanded");
    if (expanded) flags.push(expanded === "true" ? "expanded" : "collapsed");
    if (el.getAttribute("data-state") === "active") flags.push("active");
    if (el === document.activeElement || el.contains(document.activeElement)) {
      flags.push("focused");
    }
    if (el.matches("input, textarea") && el.type !== "checkbox" && el.type !== "radio") {
      flags.push(`value=${JSON.stringify(truncate(el.value, 80))}`);
    }
    const title = el.getAttribute("title");
    if (title && collapse(title) !== nameOf(el)) {
      flags.push(`title=${JSON.stringify(truncate(title, 80))}`);
    }
    return flags.length ? ` (${flags.join(", ")})` : "";
  };

  const describeElement = (el) => {
    const name = truncate(nameOf(el), MAX_NAME_CHARS);
    return `${roleOf(el)}${name ? ` "${name}"` : ""}`;
  };

  const isRendered = (el, style) => {
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    if (style.display === "contents") return true;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1 && style.overflow !== "visible") return false;
    if (rect.width < 1 && rect.height < 1 && el.children.length === 0) return false;
    if (rect.width >= 1 || rect.height >= 1) {
      if (rect.bottom < 0 || rect.right < 0) return false;
      if (rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
    }
    return true;
  };

  const isInteractive = (el, style, parentCursor) => {
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA" || tag === "SUMMARY") {
      return true;
    }
    if (tag === "INPUT") return el.type !== "hidden";
    if (tag === "A" && el.hasAttribute("href")) return true;
    const role = el.getAttribute("role");
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (el.isContentEditable && !el.parentElement?.isContentEditable) return true;
    if (el.classList.contains("xterm") || el.classList.contains("cm-editor")) return true;
    return style.cursor === "pointer" && parentCursor !== "pointer";
  };

  const ownText = (el) =>
    collapse(
      [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" "),
    );

  const registerRef = (el) => {
    const ref = `e${nextRef++}`;
    refs.set(ref, el);
    return ref;
  };

  // Actions
  const inspect = (args) => {
    refs = new Map();
    nextRef = 1;
    const root = args.selector ? document.querySelector(args.selector) : document.body;
    if (!root) throw new Error(`No element matches ${args.selector}`);
    const maxLines = Math.min(Math.max(Number(args.max_lines) || 400, 20), 3000);
    const lines = [];
    let truncated = false;

    const walk = (el, depth, parentCursor, named) => {
      if (lines.length >= maxLines) {
        truncated = true;
        return;
      }
      const style = getComputedStyle(el);
      if (!isRendered(el, style)) return;
      if (el.getAttribute("aria-hidden") === "true" && !el.classList.contains("xterm")) return;
      const indent = "  ".repeat(depth);
      const role = roleOf(el);
      let childDepth = depth;
      let childNamed = named;

      if (isInteractive(el, style, parentCursor)) {
        const label = role === "div" || role === "span" || role === "li" ? "clickable" : role;
        const name = truncate(nameOf(el), MAX_NAME_CHARS);
        lines.push(
          `${indent}- ${label} [${registerRef(el)}]${name ? ` "${name}"` : ""}${flagsOf(el)}`,
        );
        if (el.isContentEditable || el.classList.contains("xterm")) return;
        if (el.classList.contains("cm-editor")) return;
        childDepth += 1;
        childNamed = true;
      } else if (role.startsWith("heading")) {
        lines.push(`${indent}- ${role} "${truncate(nameOf(el), MAX_NAME_CHARS)}"`);
        return;
      } else if (CONTAINER_ROLES.has(role)) {
        const name = truncate(collapse(el.getAttribute("aria-label") ?? ""), MAX_NAME_CHARS);
        lines.push(`${indent}- ${role}${name ? ` "${name}"` : ""}`);
        childDepth += 1;
      } else if (!named) {
        const text = ownText(el);
        if (text) lines.push(`${indent}- text "${truncate(text, MAX_NAME_CHARS)}"`);
      }
      for (const child of el.children) walk(child, childDepth, style.cursor, childNamed);
    };

    walk(root, 0, "auto", false);
    const focused = document.activeElement;
    const header = [
      `Page "${document.title}" ${window.location.href} viewport ${window.innerWidth}x${window.innerHeight}`,
      `Focused: ${focused && focused !== document.body ? describeElement(focused) : "nothing"}`,
      "Use the [eN] refs with click, type and press; they are valid until the next inspect.",
      "",
    ];
    if (truncated) lines.push(`... cut at ${maxLines} lines; pass a selector or max_lines`);
    return [...header, ...lines].join("\n");
  };

  const findByText = (text) => {
    const needle = collapse(text).toLowerCase();
    const candidates = [...document.querySelectorAll("body *")].filter((el) => {
      const style = getComputedStyle(el);
      return (
        isRendered(el, style) &&
        isInteractive(el, style, getComputedStyle(el.parentElement ?? el).cursor)
      );
    });
    const hittable = (el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit !== null && (hit === el || el.contains(hit));
    };
    const exact = candidates.filter((el) => nameOf(el).toLowerCase() === needle);
    const partial = candidates.filter((el) => nameOf(el).toLowerCase().includes(needle));
    const pick = (list) => list.find(hittable) ?? list[0];
    const found = pick(exact) ?? pick(partial);
    if (!found) throw new Error(`No visible interactive element named ${JSON.stringify(text)}`);
    return found;
  };

  const resolveTarget = (args, optional) => {
    if (args.ref) {
      const el = refs.get(args.ref);
      if (!el || !el.isConnected) {
        throw new Error(`Ref ${args.ref} is unknown or gone; run inspect again`);
      }
      return el;
    }
    if (args.selector) {
      const el = document.querySelector(args.selector);
      if (!el) throw new Error(`No element matches ${args.selector}`);
      return el;
    }
    if (args.text) return findByText(args.text);
    if (typeof args.x === "number" && typeof args.y === "number") {
      const el = document.elementFromPoint(args.x, args.y);
      if (!el) throw new Error(`Nothing at ${args.x},${args.y}`);
      return el;
    }
    if (optional) return null;
    throw new Error("Pass ref, selector, text, or x and y");
  };

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const modifierState = (names) => {
    const state = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
    for (const raw of names ?? []) {
      const name = raw.toLowerCase();
      if (name === "mod") state[isMac ? "metaKey" : "ctrlKey"] = true;
      else if (["meta", "cmd", "command"].includes(name)) state.metaKey = true;
      else if (["ctrl", "control"].includes(name)) state.ctrlKey = true;
      else if (["alt", "option"].includes(name)) state.altKey = true;
      else if (name === "shift") state.shiftKey = true;
      else throw new Error(`Unknown modifier ${raw}`);
    }
    return state;
  };

  const settle = (args) =>
    sleep(typeof args.wait_ms === "number" ? Math.max(args.wait_ms, 0) : DEFAULT_SETTLE_MS);

  const click = async (args) => {
    const el = resolveTarget(args, false);
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const rect = el.getBoundingClientRect();
    const x = typeof args.x === "number" ? args.x : rect.left + rect.width / 2;
    const y = typeof args.y === "number" ? args.y : rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    const target = hit && (hit === el || el.contains(hit)) ? hit : el;
    const cover = hit && target === el && hit !== el ? hit : null;
    const button = args.button === "right" ? 2 : args.button === "middle" ? 1 : 0;
    const pressed = button === 2 ? 2 : button === 1 ? 4 : 1;
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: window.screenX + x,
      screenY: window.screenY + y,
      button,
      ...modifierState(args.modifiers),
    };
    const pointer = (type, buttons) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          ...common,
          buttons,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        }),
      );
    const mouse = (type, buttons, detail) =>
      target.dispatchEvent(new MouseEvent(type, { ...common, buttons, detail }));
    const press = (detail) => {
      pointer("pointerdown", pressed);
      if (mouse("mousedown", pressed, detail)) {
        const focusable = target.closest(
          "button, a[href], input, textarea, select, [tabindex], [contenteditable='true'], [contenteditable='']",
        );
        focusable?.focus({ preventScroll: true });
      }
      pointer("pointerup", 0);
      mouse("mouseup", 0, detail);
    };

    pointer("pointerover", 0);
    mouse("mouseover", 0, 0);
    pointer("pointermove", 0);
    mouse("mousemove", 0, 0);
    press(1);
    if (button === 0) {
      mouse("click", 0, 1);
      if (args.double) {
        press(2);
        mouse("click", 0, 2);
        mouse("dblclick", 0, 2);
      }
    } else if (button === 2) {
      mouse("contextmenu", 0, 1);
    } else {
      mouse("auxclick", 0, 1);
    }
    await settle(args);
    const note = cover
      ? ` (it was covered by ${describeElement(cover)}; the events went to the element anyway)`
      : "";
    return `Clicked ${describeElement(el)}${note}`;
  };

  const editableIn = (el) => {
    if (el.classList.contains("xterm") || el.closest(".xterm")) {
      return el.closest(".xterm").querySelector("textarea");
    }
    if (el.classList.contains("cm-editor")) return el.querySelector(".cm-content");
    if (el.matches(EDITABLE) || el.isContentEditable) return el;
    return el.querySelector(EDITABLE);
  };

  const insertText = (el, text) => {
    if (text && document.execCommand("insertText", false, text)) return;
    if (!el.matches("input, textarea")) {
      if (!text) return;
      throw new Error(`Could not type into ${describeElement(el)}`);
    }
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    // The prototype setter bypasses React's value tracking, so React sees the change.
    Reflect.set(
      proto.prototype,
      "value",
      el.value.slice(0, start) + text + el.value.slice(end),
      el,
    );
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }),
    );
  };

  const type = async (args) => {
    const text = String(args.text ?? "");
    const base = resolveTarget({ ...args, text: args.target_text }, true) ?? document.activeElement;
    const el = base && base !== document.body ? editableIn(base) : null;
    if (!el) {
      throw new Error(
        "Nothing editable; pass the ref of an input, editor or terminal, or click one first",
      );
    }
    el.focus({ preventScroll: true });
    if (args.clear) {
      if (el.matches("input, textarea")) el.select();
      else document.execCommand("selectAll");
      if (!text) document.execCommand("delete");
    }
    insertText(el, text);
    if (args.submit) await dispatchKey(el, "Enter");
    await settle(args);
    return `Typed ${text.length} characters into ${describeElement(el)}${args.submit ? " and pressed Enter" : ""}`;
  };

  const NAMED_KEYS = {
    enter: ["Enter", "Enter", 13],
    return: ["Enter", "Enter", 13],
    escape: ["Escape", "Escape", 27],
    esc: ["Escape", "Escape", 27],
    tab: ["Tab", "Tab", 9],
    backspace: ["Backspace", "Backspace", 8],
    delete: ["Delete", "Delete", 46],
    space: [" ", "Space", 32],
    arrowup: ["ArrowUp", "ArrowUp", 38],
    arrowdown: ["ArrowDown", "ArrowDown", 40],
    arrowleft: ["ArrowLeft", "ArrowLeft", 37],
    arrowright: ["ArrowRight", "ArrowRight", 39],
    up: ["ArrowUp", "ArrowUp", 38],
    down: ["ArrowDown", "ArrowDown", 40],
    left: ["ArrowLeft", "ArrowLeft", 37],
    right: ["ArrowRight", "ArrowRight", 39],
    home: ["Home", "Home", 36],
    end: ["End", "End", 35],
    pageup: ["PageUp", "PageUp", 33],
    pagedown: ["PageDown", "PageDown", 34],
    plus: ["+", "Equal", 187],
  };
  const PUNCTUATION = {
    ",": ["Comma", 188],
    ".": ["Period", 190],
    "/": ["Slash", 191],
    ";": ["Semicolon", 186],
    "'": ["Quote", 222],
    "[": ["BracketLeft", 219],
    "]": ["BracketRight", 221],
    "\\": ["Backslash", 220],
    "-": ["Minus", 189],
    "=": ["Equal", 187],
    "`": ["Backquote", 192],
  };

  const parseKey = (combo) => {
    const parts = String(combo).split("+");
    const keyName = parts.pop() || "+";
    const modifiers = modifierState(parts.filter(Boolean));
    const named = NAMED_KEYS[keyName.toLowerCase()];
    if (named) return { key: named[0], code: named[1], keyCode: named[2], modifiers };
    const fn = /^f([1-9]|1[0-2])$/i.exec(keyName);
    if (fn) {
      const n = Number(fn[1]);
      return { key: `F${n}`, code: `F${n}`, keyCode: 111 + n, modifiers };
    }
    if (keyName.length !== 1) throw new Error(`Unknown key ${keyName}`);
    const upper = keyName.toUpperCase();
    if (/[A-Z]/.test(upper)) {
      const key = modifiers.shiftKey ? upper : keyName.toLowerCase();
      return { key, code: `Key${upper}`, keyCode: upper.charCodeAt(0), modifiers };
    }
    if (/[0-9]/.test(keyName)) {
      return { key: keyName, code: `Digit${keyName}`, keyCode: keyName.charCodeAt(0), modifiers };
    }
    const punctuation = PUNCTUATION[keyName] ?? ["", 0];
    return { key: keyName, code: punctuation[0], keyCode: punctuation[1], modifiers };
  };

  const keyboardEvent = (type, parsed) => {
    const event = new KeyboardEvent(type, {
      key: parsed.key,
      code: parsed.code,
      bubbles: true,
      cancelable: true,
      composed: true,
      ...parsed.modifiers,
    });
    Object.defineProperty(event, "keyCode", { get: () => parsed.keyCode });
    Object.defineProperty(event, "which", { get: () => parsed.keyCode });
    return event;
  };

  const dispatchKey = async (target, combo) => {
    const parsed = parseKey(combo);
    const accepted = target.dispatchEvent(keyboardEvent("keydown", parsed));
    const { ctrlKey, metaKey, altKey } = parsed.modifiers;
    const printable = parsed.key.length === 1 && !ctrlKey && !metaKey && !altKey;
    if (accepted && printable && (target.matches(EDITABLE) || target.isContentEditable)) {
      insertText(target, parsed.key);
    }
    target.dispatchEvent(keyboardEvent("keyup", parsed));
    return accepted;
  };

  const press = async (args) => {
    const resolved = resolveTarget(args, true);
    let target = resolved ? (editableIn(resolved) ?? resolved) : document.activeElement;
    if (!target || target === document.documentElement) target = document.body;
    if (resolved) target.focus?.({ preventScroll: true });
    const accepted = await dispatchKey(target, args.key);
    await settle(args);
    return `Pressed ${args.key} on ${target === document.body ? "the page" : describeElement(target)}${accepted ? "" : " (the app handled it)"}`;
  };

  const waitFor = async (args) => {
    const timeout = Math.min(Math.max(Number(args.timeout_ms) || 5000, 100), 120000);
    if (!args.text && !args.selector) throw new Error("Pass text or selector");
    const present = () => {
      if (args.selector) {
        const el = document.querySelector(args.selector);
        return el !== null && isRendered(el, getComputedStyle(el));
      }
      return (document.body.innerText ?? "").includes(args.text);
    };
    const wanted = !args.gone;
    const started = Date.now();
    while (present() !== wanted) {
      if (Date.now() - started > timeout) {
        throw new Error(
          `Timed out after ${timeout} ms waiting for ${args.selector ?? JSON.stringify(args.text)}${wanted ? "" : " to disappear"}`,
        );
      }
      await sleep(100);
    }
    return `${wanted ? "Found" : "Gone"} after ${Date.now() - started} ms`;
  };

  const consoleLogs = (args) => {
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), MAX_LOG_ENTRIES);
    const levels = args.level ? new Set([].concat(args.level)) : null;
    const entries = logs.filter((entry) => !levels || levels.has(entry.level)).slice(-limit);
    if (args.clear) logs.length = 0;
    if (entries.length === 0) return "No console messages";
    return entries.map((entry) => `${entry.time} [${entry.level}] ${entry.text}`).join("\n");
  };

  const ACTIONS = {
    inspect,
    click,
    type,
    press,
    wait_for: waitFor,
    console_logs: consoleLogs,
  };

  const finish = (id, ok, text) => {
    results.set(id, JSON.stringify({ ok, text: truncate(text, MAX_RESULT_CHARS) }));
    if (results.size > MAX_RESULTS) results.delete(results.keys().next().value);
  };

  const start = (id, action, args, script) => {
    const handler = action === "eval" ? script : ACTIONS[action];
    if (typeof handler !== "function") {
      finish(id, false, `Unknown page action: ${action}`);
      return "started";
    }
    Promise.resolve()
      .then(() => handler(args ?? {}))
      .then(
        (value) => finish(id, true, describeValue(value)),
        (error) => finish(id, false, describeValue(error)),
      );
    return "started";
  };

  const take = (id) => {
    const result = results.get(id) ?? null;
    results.delete(id);
    return result;
  };

  Object.defineProperty(window, "__pragmaDevBridge", {
    value: Object.freeze({ start, take }),
    configurable: false,
    writable: false,
  });
})();
