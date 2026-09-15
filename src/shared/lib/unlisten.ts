import type { UnlistenFn } from "@tauri-apps/api/event";

const RETRY_DELAYS_MS = [0, 50, 250];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Tauri registers the JS half of `listen` with an async eval, so a listener that
/// is unlistened immediately afterwards (React StrictMode remounts, fast effects)
/// can reject before the webview has seen the registration. The rejection would
/// also leave the listener registered in Rust, so retry instead of swallowing.
export async function unlistenQuietly(unlisten: UnlistenFn | null | undefined): Promise<void> {
  if (!unlisten) {
    return;
  }
  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    try {
      await Promise.resolve(unlisten());
      return;
    } catch {
      // The registration eval has not landed yet; the next attempt retries.
    }
  }
}
