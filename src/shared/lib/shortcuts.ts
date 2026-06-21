export type ModifierKey = "ctrl" | "meta" | "shift" | "alt";

export interface ShortcutBinding {
  key?: string;
  code?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutActionCategory = "file" | "edit" | "view" | "ai" | "chat";

export interface ShortcutAction {
  id: string;
  label: string;
  category: ShortcutActionCategory;
  default: ShortcutBinding | ((isMac: boolean) => ShortcutBinding | null);
}

export const SHORTCUT_ACTIONS = [
  {
    id: "file.open" as const,
    label: "Open File",
    category: "file" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyO",
    }),
  },
  {
    id: "file.save" as const,
    label: "Save File",
    category: "file" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyS",
    }),
  },
  {
    id: "file.closeTab" as const,
    label: "Close Tab",
    category: "file" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyW",
    }),
  },
  {
    id: "edit.editWithAI" as const,
    label: "Edit Selection with AI",
    category: "edit" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyL",
    }),
  },
  {
    id: "view.toggleSidebar" as const,
    label: "Toggle Sidebar",
    category: "view" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyB",
    }),
  },
  {
    id: "view.toggleTerminal" as const,
    label: "Toggle Terminal",
    category: "view" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      shift: true,
      code: "KeyT",
    }),
  },
  {
    id: "view.newTerminalTab" as const,
    label: "New Terminal Tab",
    category: "view" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "KeyT",
    }),
  },
  {
    id: "view.openSettings" as const,
    label: "Open Settings",
    category: "view" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      code: "Comma",
    }),
  },
  {
    id: "ai.toggle" as const,
    label: "Toggle AI Chat",
    category: "ai" as const,
    default: (isMac: boolean): ShortcutBinding => ({
      [isMac ? "meta" : "ctrl"]: true,
      shift: true,
      code: "KeyA",
    }),
  },
  {
    id: "chat.send" as const,
    label: "Send Chat Message",
    category: "chat" as const,
    default: (): ShortcutBinding => ({ key: "Enter" }),
  },
] satisfies ShortcutAction[];

export type ShortcutActionId = (typeof SHORTCUT_ACTIONS)[number]["id"];

export type ShortcutMap = Record<ShortcutActionId, ShortcutBinding | null>;

export function getIsMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function getDefaultShortcuts(isMac: boolean): ShortcutMap {
  const map = {} as Record<ShortcutActionId, ShortcutBinding | null>;
  for (const action of SHORTCUT_ACTIONS) {
    const binding = typeof action.default === "function" ? action.default(isMac) : action.default;
    map[action.id] = binding;
  }
  return map;
}

export function matchShortcut(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "key" | "code">,
  binding: ShortcutBinding | null | undefined,
): boolean {
  if (!binding) return false;

  if (
    !!event.ctrlKey !== !!binding.ctrl ||
    !!event.metaKey !== !!binding.meta ||
    !!event.shiftKey !== !!binding.shift ||
    !!event.altKey !== !!binding.alt
  ) {
    return false;
  }

  if (binding.code) {
    return event.code === binding.code;
  }

  if (binding.key) {
    return event.key === binding.key;
  }

  return false;
}

function canonicalKey(binding: ShortcutBinding): string {
  if (binding.code) {
    if (binding.code.startsWith("Key")) return binding.code.slice(3).toLowerCase();
    if (binding.code.startsWith("Digit")) return binding.code.slice(5).toLowerCase();
    return binding.code.toLowerCase();
  }
  return (binding.key ?? "").toLowerCase();
}

export function isConflict(
  a: ShortcutBinding | null | undefined,
  b: ShortcutBinding | null | undefined,
): boolean {
  if (!a || !b) return false;

  if (
    !!a.ctrl !== !!b.ctrl ||
    !!a.meta !== !!b.meta ||
    !!a.shift !== !!b.shift ||
    !!a.alt !== !!b.alt
  ) {
    return false;
  }

  return canonicalKey(a) === canonicalKey(b);
}

export function findConflictingAction(
  actionId: ShortcutActionId,
  binding: ShortcutBinding | null,
  shortcuts: ShortcutMap,
): ShortcutActionId | null {
  if (!binding) return null;

  for (const [id, other] of Object.entries(shortcuts)) {
    if (id === actionId) continue;
    if (isConflict(binding, other)) {
      return id as ShortcutActionId;
    }
  }

  return null;
}

const MODIFIER_SYMBOLS_MAC: Record<ModifierKey, string> = {
  meta: "⌘",
  alt: "⌥",
  shift: "⇧",
  ctrl: "⌃",
};

const MODIFIER_NAMES_OTHER: Record<ModifierKey, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  meta: "Win",
};

function formatKey(binding: ShortcutBinding): string {
  if (binding.code) {
    if (binding.code.startsWith("Key")) return binding.code.slice(3);
    if (binding.code.startsWith("Digit")) return binding.code.slice(5);
    if (binding.code.startsWith("Numpad")) return binding.code;
    switch (binding.code) {
      case "Comma":
        return ",";
      case "Period":
        return ".";
      case "Slash":
        return "/";
      case "Backquote":
        return "`";
      case "BracketLeft":
        return "[";
      case "BracketRight":
        return "]";
      case "Semicolon":
        return ";";
      case "Quote":
        return "'";
      case "Minus":
        return "-";
      case "Equal":
        return "=";
      case "Backslash":
        return "\\";
      default:
        return binding.code;
    }
  }

  if (binding.key) {
    if (binding.key.length === 1) return binding.key.toUpperCase();
    return binding.key;
  }

  return "?";
}

export function formatShortcut(
  binding: ShortcutBinding | null | undefined,
  isMac: boolean,
): string {
  if (!binding) return "None";

  const parts: string[] = [];
  const modifiers = isMac
    ? (["meta", "alt", "shift", "ctrl"] as ModifierKey[])
    : (["ctrl", "alt", "shift", "meta"] as ModifierKey[]);
  const labels = isMac ? MODIFIER_SYMBOLS_MAC : MODIFIER_NAMES_OTHER;

  for (const modifier of modifiers) {
    if (binding[modifier]) {
      parts.push(labels[modifier]);
    }
  }

  parts.push(formatKey(binding));
  return parts.join(isMac ? "" : "+");
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

export function isValidBinding(binding: ShortcutBinding | null): binding is ShortcutBinding {
  if (!binding) return false;
  if (!binding.code && !binding.key) return false;
  if (binding.key && isModifierKey(binding.key)) return false;
  return true;
}
