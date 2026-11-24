import type { IBuffer, ITerminalOptions } from "@xterm/xterm";

const ESC = String.fromCharCode(0x1b);
const QUERIES_ONLY = new RegExp(`^(?:${ESC}\\[\\??6n)+$`);
const QUERY = new RegExp(`${ESC}\\[(\\??)6n`, "g");

interface WritableTerminal {
  write(data: string, callback?: () => void): void;
  readonly buffer: { readonly active: Pick<IBuffer, "cursorX" | "cursorY"> };
  readonly options: Pick<ITerminalOptions, "disableStdin">;
}

/// Writes PTY output to xterm, but answers a chunk of nothing but cursor position queries itself.
/// Coding CLIs poll several times a second, and every xterm write repaints the cursor row.
export function createOutputWriter(
  term: WritableTerminal,
  reply: (data: string) => void,
): (data: string, onParsed?: () => void) => void {
  let pending = 0;
  return (data, onParsed) => {
    // Earlier output still being parsed or a silent replay needs xterm's own, ordered answer.
    if (pending === 0 && !term.options.disableStdin && QUERIES_ONLY.test(data)) {
      const { cursorX, cursorY } = term.buffer.active;
      reply(
        data.replace(QUERY, (_, mark: string) => `${ESC}[${mark}${cursorY + 1};${cursorX + 1}R`),
      );
      return;
    }
    pending += 1;
    term.write(data, () => {
      pending -= 1;
      onParsed?.();
    });
  };
}

/// True for output that only asks the terminal where its cursor is.
export function isCursorQueryOnly(data: string): boolean {
  return QUERIES_ONLY.test(data);
}
