export type TerminalAttention = "finished" | "input";

/// Title of the OSC 777 notifications that the hooks Pragma configures for a CLI send.
export const PRAGMA_NOTIFY_TITLE = "Pragma";

const MAX_OSC_LENGTH = 1024;
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

/** What a Pragma hook reports besides attention: the CLI's own session id, or its usage limit. */
export type PragmaReport = { kind: "session"; id: string } | { kind: "limit" };
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
    if (title === PRAGMA_NOTIFY_TITLE) return body === "finished" || body === "input" ? body : null;
    return classify(`${title} ${body}`);
  }
  return null;
}

/// Reads a report from a Pragma hook, such as the session id the CLI started.
export function oscPragmaReport(payload: string): PragmaReport | null {
  const [code, kind, title, ...rest] = payload.split(";");
  if (code !== "777" || kind !== "notify" || title !== PRAGMA_NOTIFY_TITLE) return null;
  const body = rest.join(";");
  if (body === "limit") return { kind: "limit" };
  const id = body.startsWith("session:") ? body.slice("session:".length) : "";
  return SESSION_ID.test(id) ? { kind: "session", id } : null;
}

/// Finds bells and desktop notifications in PTY output, even when a sequence spans chunks.
export function createAttentionParser(
  onReport?: (report: PragmaReport) => void,
): (data: string) => TerminalAttention[] {
  let state: ParserState = "ground";
  let osc = "";

  return (data) => {
    const found: TerminalAttention[] = [];
    const finishOsc = () => {
      const report = oscPragmaReport(osc);
      const attention = report ? null : oscAttention(osc);
      if (report) onReport?.(report);
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
