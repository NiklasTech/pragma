/** Wordings of internal errors that mean something to the user, the first match wins. */
const PLAIN: ReadonlyArray<[RegExp, string]> = [
  [/^ACP request timed out$/i, "The agent did not answer in time."],
  [/^ACP connection closed$/i, "The agent stopped."],
  [/^Approval request timed out$/i, "Nobody answered the approval in time."],
];

/** Prefixes that name a layer of Pragma, a protocol or an error code instead of the problem. */
const NOISE = [
  /^(uncaught )?error:\s*/i,
  /^ACP JSON-RPC error -?\d+:\s*/i,
  /^JSON-RPC error -?\d+:\s*/i,
  /^JSON-RPC error \(-?\d+\):?\s*/i,
  /^ACP protocol error:\s*/i,
  /^io error:\s*/i,
];

/** An error as one plain sentence for a toast or a chat: no class names, codes or protocol names. */
export function errorText(error: unknown, fallback = "Something went wrong."): string {
  let text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  text = text.trim();
  for (let changed = true; changed;) {
    changed = false;
    for (const prefix of NOISE) {
      const next = text.replace(prefix, "");
      if (next !== text) {
        text = next.trim();
        changed = true;
      }
    }
  }
  text = text.replace(/\s*\(os error \d+\)/gi, "").trim();
  for (const [pattern, plain] of PLAIN) if (pattern.test(text)) return plain;
  // Kept as it is: the text often goes on a sentence such as "Could not save: ...".
  return text || fallback;
}
