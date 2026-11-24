import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

const MIN_FONT_SIZE = 8;

/** The font size at which `cols` columns take the room `fittingCols` take at `fontSize`. */
export function shrunkFontSize(fontSize: number, fittingCols: number, cols: number): number {
  if (cols <= fittingCols) return fontSize;
  const size = Math.floor(((fontSize * fittingCols) / cols) * 10) / 10;
  return Math.min(fontSize, Math.max(MIN_FONT_SIZE, size));
}

/**
 * Nothing redraws the last screen of an ended program, so it keeps the columns it was drawn for:
 * the text gets smaller, and what still does not fit scrolls sideways.
 */
export function fitEndedTerminal(
  term: Terminal,
  fit: FitAddon,
  fontSize: number,
  cols: number,
): void {
  term.options.fontSize = fontSize;
  const fitting = fit.proposeDimensions();
  if (!fitting || !Number.isFinite(fitting.cols)) return;
  term.options.fontSize = shrunkFontSize(fontSize, fitting.cols, cols);
  const rows = fit.proposeDimensions()?.rows ?? fitting.rows;
  if (Number.isFinite(rows)) term.resize(cols, rows);
}
