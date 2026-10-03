import type { ShortcutBinding } from "@/shared/lib/shortcuts";

const NAMED_KEYS: Record<string, string> = {
  enter: "Enter",
  escape: "Escape",
  esc: "Escape",
  tab: "Tab",
  space: " ",
  backspace: "Backspace",
  delete: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
};

const PUNCTUATION_CODES: Record<string, string> = {
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "-": "Minus",
  "=": "Equal",
  "`": "Backquote",
  "\\": "Backslash",
};

/// Parses "ctrl+shift+k" style keys; "mod" is Cmd on macOS and Ctrl elsewhere.
/// Bindings without a modifier are rejected except for function keys, so typing keeps working.
export function parseKeybinding(spec: string, isMac: boolean): ShortcutBinding | null {
  const parts = spec
    .toLowerCase()
    .split("+")
    .map((part) => part.trim());
  // "ctrl++" names the plus key.
  if (spec.endsWith("++")) parts.splice(parts.length - 2, 2, "+");
  const keyName = parts.pop();
  if (!keyName) return null;

  const binding: ShortcutBinding = {};
  for (const modifier of parts) {
    switch (modifier) {
      case "ctrl":
      case "control":
        binding.ctrl = true;
        break;
      case "cmd":
      case "command":
      case "meta":
      case "super":
        binding.meta = true;
        break;
      case "alt":
      case "option":
        binding.alt = true;
        break;
      case "shift":
        binding.shift = true;
        break;
      case "mod":
        if (isMac) binding.meta = true;
        else binding.ctrl = true;
        break;
      default:
        return null;
    }
  }

  const functionKey = /^f([1-9]|1[0-2])$/.test(keyName);
  if (/^[a-z]$/.test(keyName)) {
    binding.code = `Key${keyName.toUpperCase()}`;
  } else if (/^[0-9]$/.test(keyName)) {
    binding.code = `Digit${keyName}`;
  } else if (functionKey) {
    binding.key = keyName.toUpperCase();
  } else if (PUNCTUATION_CODES[keyName]) {
    binding.code = PUNCTUATION_CODES[keyName];
  } else if (NAMED_KEYS[keyName]) {
    binding.key = NAMED_KEYS[keyName];
  } else if (keyName === "+") {
    binding.key = "+";
  } else {
    return null;
  }

  const hasModifier = binding.ctrl || binding.meta || binding.alt;
  if (!hasModifier && !functionKey) return null;
  return binding;
}
