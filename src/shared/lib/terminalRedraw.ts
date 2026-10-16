export interface TerminalSize {
  cols: number;
  rows: number;
}

/**
 * Sizes that make the program in a PTY draw itself again: one row off, then the real size.
 * The kernel only signals a resize when the size actually changes.
 */
export function redrawSizes(cols: number, rows: number): TerminalSize[] {
  const nudged = rows > 2 ? rows - 1 : rows + 1;
  return [
    { cols, rows: nudged },
    { cols, rows },
  ];
}

/** Resizes through `redrawSizes` so a full-screen program repaints a reattached terminal. */
export async function forceTerminalRedraw(
  resize: (cols: number, rows: number) => Promise<unknown>,
  cols: number,
  rows: number,
): Promise<void> {
  for (const size of redrawSizes(cols, rows)) {
    await resize(size.cols, size.rows);
  }
}
