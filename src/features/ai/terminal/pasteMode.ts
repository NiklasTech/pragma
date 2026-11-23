const PASTE_ON = "\x1b[?2004h";
const PASTE_OFF = "\x1b[?2004l";
/** Output kept from the previous chunk, so a switch split across two chunks is still seen. */
const CARRY = PASTE_ON.length - 1;

export interface PasteModeState {
  on: boolean;
  carry: string;
}

export const PASTE_MODE_OFF: PasteModeState = { on: false, carry: "" };

/** Whether the program in the terminal asked for bracketed paste, after one more chunk of output. */
export function nextPasteMode(state: PasteModeState, chunk: string): PasteModeState {
  const text = state.carry + chunk;
  const on = text.lastIndexOf(PASTE_ON);
  const off = text.lastIndexOf(PASTE_OFF);
  return {
    on: on === off ? state.on : on > off,
    carry: text.slice(-CARRY),
  };
}

/** Text the program reads as one paste, so its line breaks do not submit it line by line. */
export function bracketedPaste(text: string): string {
  return `\x1b[200~${text}\x1b[201~`;
}
