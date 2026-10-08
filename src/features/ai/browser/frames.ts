const POLL_MS = 100;
const MISSING_FRAME_MS = 1500;
const LOAD_TIMEOUT_MS = 10_000;

const frames = new Map<string, HTMLIFrameElement>();
const loaded = new WeakSet<HTMLIFrameElement>();

/// Ref callback of a browser pane's iframe; tracks it while it is mounted.
export function registerBrowserFrame(leafId: string, frame: HTMLIFrameElement | null): void {
  if (!frame) {
    frames.delete(leafId);
    return;
  }
  if (frames.get(leafId) === frame) return;
  frames.set(leafId, frame);
  frame.addEventListener("load", () => loaded.add(frame));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Waits until the pane shows `url` and the page has loaded; `waited` tells whether it had to.
export async function loadedBrowserFrame(
  leafId: string,
  url: string,
): Promise<{ frame: HTMLIFrameElement; waited: boolean }> {
  const start = Date.now();
  let waited = false;
  for (;;) {
    const frame = frames.get(leafId);
    if (frame && frame.getAttribute("src") === url && loaded.has(frame)) {
      return { frame, waited };
    }
    const elapsed = Date.now() - start;
    if (!frame && elapsed > MISSING_FRAME_MS) {
      throw new Error("The browser pane is not shown. Bring it to the front and try again.");
    }
    if (elapsed > LOAD_TIMEOUT_MS) {
      throw new Error("The page in the browser pane did not finish loading in time.");
    }
    waited = true;
    await delay(POLL_MS);
  }
}
