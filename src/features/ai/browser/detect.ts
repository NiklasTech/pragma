const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// CSI sequences (colors, cursor moves) and OSC sequences (titles, hyperlinks).
const ANSI_SEQUENCE = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BEL}${ESC}]*(${BEL}|${ESC}\\\\)`,
  "g",
);
const LOCAL_URL = /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/[^\s"'`<>()[\]{}]*)?/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE, "");
}

/// The last localhost, 127.0.0.1 or ::1 URL in the text, or null.
export function findLatestLocalUrl(text: string): string | null {
  const matches = stripAnsi(text).match(LOCAL_URL);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace(TRAILING_PUNCTUATION, "");
  try {
    return new URL(last).href;
  } catch {
    return null;
  }
}
