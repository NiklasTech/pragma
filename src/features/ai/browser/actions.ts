const REQUEST_TYPE = "pragma:browser-action";
const RESULT_TYPE = "pragma:browser-action-result";
const REPLY_TIMEOUT_MS = 5000;

export type BrowserAction = "read" | "click" | "type";

export interface BrowserActionReply {
  ok: boolean;
  text: string;
}

/// Reads the capture script's answer to the request `id`; anything else yields null.
export function parseActionReply(data: unknown, id: string): BrowserActionReply | null {
  if (typeof data !== "object" || data === null) return null;
  const reply = data as Record<string, unknown>;
  if (reply.type !== RESULT_TYPE || reply.id !== id) return null;
  if (typeof reply.ok !== "boolean" || typeof reply.text !== "string") return null;
  return { ok: reply.ok, text: reply.text };
}

/// Asks the capture script in the frame to read the page, or to click or type into it.
export function requestFrameAction(
  frame: HTMLIFrameElement,
  action: BrowserAction,
  args: Record<string, unknown> = {},
): Promise<string> {
  const target = frame.contentWindow;
  if (!target) return Promise.reject(new Error("The browser pane has no page loaded."));
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== target) return;
      const reply = parseActionReply(event.data, id);
      if (!reply) return;
      cleanup();
      if (reply.ok) resolve(reply.text);
      else reject(new Error(reply.text));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The page did not answer. Pragma cannot reach pages that failed to load."));
    }, REPLY_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
    target.postMessage({ type: REQUEST_TYPE, id, action, args }, "*");
  });
}
