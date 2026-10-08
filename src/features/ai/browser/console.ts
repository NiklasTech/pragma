const REQUEST_TYPE = "pragma:browser-console";
const RESULT_TYPE = "pragma:browser-console-result";
const REPLY_TIMEOUT_MS = 2000;

export interface BrowserConsoleEntry {
  level: string;
  text: string;
  time: number;
}

export interface BrowserConsoleSnapshot {
  url: string;
  entries: BrowserConsoleEntry[];
}

function readEntry(value: unknown): BrowserConsoleEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.level !== "string" || typeof entry.text !== "string") return null;
  return {
    level: entry.level,
    text: entry.text,
    time: typeof entry.time === "number" ? entry.time : 0,
  };
}

/// Reads the capture script's answer to the request `id`; anything else yields null.
export function parseConsoleReply(data: unknown, id: string): BrowserConsoleSnapshot | null {
  if (typeof data !== "object" || data === null) return null;
  const reply = data as Record<string, unknown>;
  if (reply.type !== RESULT_TYPE || reply.id !== id || !Array.isArray(reply.entries)) return null;
  return {
    url: typeof reply.url === "string" ? reply.url : "",
    entries: reply.entries
      .map(readEntry)
      .filter((entry): entry is BrowserConsoleEntry => entry !== null),
  };
}

export function formatConsole(snapshot: BrowserConsoleSnapshot, limit: number): string {
  const total = snapshot.entries.length;
  if (total === 0) {
    return `No console messages, errors or failed requests since ${snapshot.url} loaded.`;
  }
  const shown = snapshot.entries.slice(-limit);
  const header =
    shown.length < total
      ? `Console of ${snapshot.url}, the last ${shown.length} of ${total} entries (times in UTC):`
      : `Console of ${snapshot.url}, ${total} entries (times in UTC):`;
  const lines = shown.map((entry) => {
    const time = new Date(entry.time).toISOString().slice(11, 19);
    return `[${time}] ${entry.level}: ${entry.text}`;
  });
  return [header, ...lines].join("\n");
}

/// Asks the capture script in the frame for the console entries of its page.
export function requestFrameConsole(frame: HTMLIFrameElement): Promise<BrowserConsoleSnapshot> {
  const target = frame.contentWindow;
  if (!target) return Promise.reject(new Error("The browser pane has no page loaded."));
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== target) return;
      const snapshot = parseConsoleReply(event.data, id);
      if (!snapshot) return;
      cleanup();
      resolve(snapshot);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "The page did not answer. Pragma cannot read the console of pages that failed to load.",
        ),
      );
    }, REPLY_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
    target.postMessage({ type: REQUEST_TYPE, id }, "*");
  });
}
