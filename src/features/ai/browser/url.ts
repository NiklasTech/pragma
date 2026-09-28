export const BROWSER_URL_ERROR = "Only http and https URLs can be opened";

export type BrowserUrlResult = { ok: true; url: string } | { ok: false; error: string };

const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const HOST_WITH_PORT = /^[^/:\s]+:\d+(\/|$)/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/// Accepts http and https URLs; a bare host gets http for local hosts and https otherwise.
export function parseBrowserUrl(input: string): BrowserUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: BROWSER_URL_ERROR };

  let candidate = trimmed;
  if (!SCHEME.test(trimmed) || HOST_WITH_PORT.test(trimmed)) {
    candidate = `${LOCAL_HOST.test(trimmed) ? "http" : "https"}://${trimmed}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: BROWSER_URL_ERROR };
    }
    if (!url.hostname) return { ok: false, error: BROWSER_URL_ERROR };
    return { ok: true, url: url.href };
  } catch {
    return { ok: false, error: BROWSER_URL_ERROR };
  }
}

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
