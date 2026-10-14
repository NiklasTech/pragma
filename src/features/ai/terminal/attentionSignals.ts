export type TerminalAttention = "finished" | "input";

/// Title of the OSC 777 notifications that the hooks Pragma configures for a CLI send.
export const PRAGMA_NOTIFY_TITLE = "Pragma";

const MAX_OSC_LENGTH = 1024;
const INPUT_PATTERN = /approv|permission|input|waiting|confirm/i;

type ParserState = "ground" | "escape" | "osc" | "osc-escape" | "string" | "string-escape";

function classify(text: string): TerminalAttention {
  return INPUT_PATTERN.test(text) ? "input" : "finished";
}

/// Reads an OSC 9 (iTerm2) or OSC 777 (urxvt) desktop notification.
export function oscAttention(payload: string): TerminalAttention | null {
  const [code, ...fields] = payload.split(";");
  if (code === "9") {
    // ConEmu reuses OSC 9 with numeric subcommands, for example 9;4 for progress.
    if (/^\d+$/.test(fields[0] ?? "")) return null;
    return classify(fields.join(";"));
  }
  if (code === "777" && fields[0] === "notify") {
    const title = fields[1] ?? "";
    const body = fields.slice(2).join(";");
    if (title === PRAGMA_NOTIFY_TITLE && (body === "finished" || body === "input")) return body;
    return classify(`${title} ${body}`);
  }
  return null;
}

/// Finds bells and desktop notifications in PTY output, even when a sequence spans chunks.
export function createAttentionParser(): (data: string) => TerminalAttention[] {
  let state: ParserState = "ground";
  let osc = "";

  return (data) => {
    const found: TerminalAttention[] = [];
    const finishOsc = () => {
      const attention = oscAttention(osc);
      if (attention) found.push(attention);
      osc = "";
      state = "ground";
    };

    for (const char of data) {
      switch (state) {
        case "ground":
          if (char === "\x07") found.push("input");
          else if (char === "\x1b") state = "escape";
          break;
        case "escape":
          if (char === "]") state = "osc";
          else if (char === "P" || char === "X" || char === "^" || char === "_") state = "string";
          else if (char !== "\x1b") state = "ground";
          break;
        case "osc":
          if (char === "\x07") finishOsc();
          else if (char === "\x1b") state = "osc-escape";
          else if (osc.length < MAX_OSC_LENGTH) osc += char;
          break;
        case "osc-escape":
          if (char === "\\") finishOsc();
          else {
            osc = "";
            state = "ground";
          }
          break;
        case "string":
          if (char === "\x07") state = "ground";
          else if (char === "\x1b") state = "string-escape";
          break;
        case "string-escape":
          state = char === "\\" ? "ground" : "string";
          break;
      }
    }
    return found;
  };
}
