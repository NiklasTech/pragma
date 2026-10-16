import type { IBufferLine, ILink, ILinkProvider, Terminal } from "@xterm/xterm";
import { getIsMac } from "@/shared/lib/shortcuts";
import { findPathLinks, isLinkModifier } from "@/shared/lib/terminalLinks";
import { openTerminalPath } from "./openTerminalPath";

/** The line's text and, for every character, the 1-based cell column it starts in. */
function lineCells(line: IBufferLine, cols: number): { text: string; columns: number[] } {
  let text = "";
  const columns: number[] = [];
  for (let x = 0; x < cols; x++) {
    const cell = line.getCell(x);
    if (!cell || cell.getWidth() === 0) continue;
    const chars = cell.getChars() || " ";
    for (let i = 0; i < chars.length; i++) columns.push(x + 1);
    text += chars;
  }
  return { text, columns };
}

/** Cmd- or Ctrl-click on a file path in the terminal opens it in the editor. */
export function pathLinkProvider(terminal: Terminal, cwd: () => string | null): ILinkProvider {
  const isMac = getIsMac();
  return {
    provideLinks(y, callback) {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const { text, columns } = lineCells(line, terminal.cols);
      const links: ILink[] = findPathLinks(text).map((link) => ({
        range: {
          start: { x: columns[link.start] ?? 1, y },
          end: { x: columns[link.end - 1] ?? terminal.cols, y },
        },
        text: text.slice(link.start, link.end),
        decorations: { pointerCursor: true, underline: true },
        activate: (event) => {
          if (!isLinkModifier(event, isMac)) return;
          event.preventDefault();
          void openTerminalPath(link, cwd());
        },
      }));
      callback(links.length > 0 ? links : undefined);
    },
  };
}

/** URL clicks need the same modifier as paths, so a plain click only selects text. */
export function urlLinkHandler(
  open: (url: string) => void,
): (event: MouseEvent, url: string) => void {
  const isMac = getIsMac();
  return (event, url) => {
    if (!isLinkModifier(event, isMac)) return;
    event.preventDefault();
    open(url);
  };
}
