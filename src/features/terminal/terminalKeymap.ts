export type TerminalKeyAction =
  | { type: "send"; data: string }
  | { type: "clear" }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "selectAll" };

type TerminalKeyEvent = Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "key">;

const CMD_KEYS: Record<string, TerminalKeyAction> = {
  k: { type: "clear" },
  c: { type: "copy" },
  v: { type: "paste" },
  a: { type: "selectAll" },
  ArrowLeft: { type: "send", data: "\x01" },
  ArrowRight: { type: "send", data: "\x05" },
  Backspace: { type: "send", data: "\x15" },
};

const OPTION_KEYS: Record<string, TerminalKeyAction> = {
  ArrowLeft: { type: "send", data: "\x1bb" },
  ArrowRight: { type: "send", data: "\x1bf" },
  Backspace: { type: "send", data: "\x17" },
};

/** Maps the macOS Terminal.app shortcuts (Cmd and Option combinations) to terminal actions. */
export function macTerminalKeyAction(event: TerminalKeyEvent): TerminalKeyAction | null {
  if (event.ctrlKey || event.shiftKey || event.metaKey === event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return (event.metaKey ? CMD_KEYS : OPTION_KEYS)[key] ?? null;
}
