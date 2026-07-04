import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function writeFallback(text: string): Promise<void> {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
}

async function readFallback(): Promise<string> {
  if (!navigator.clipboard) return "";
  return navigator.clipboard.readText();
}

export async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;

  if (isTauri()) {
    try {
      await writeText(text);
      return;
    } catch {
      // Fall through to browser API if the plugin is unavailable.
    }
  }

  await writeFallback(text);
}

export async function readFromClipboard(): Promise<string> {
  if (isTauri()) {
    try {
      return await readText();
    } catch {
      // Fall through to browser API if the plugin is unavailable.
    }
  }

  return readFallback();
}
