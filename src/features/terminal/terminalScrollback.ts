import { getWindowScope, isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useSettingsStore } from "@/shared/stores/settings";
import { restorableTerminalState, useTerminalStore } from "@/shared/stores/terminal";
import { readTerminalOutput } from "./terminalOutput";

const STORAGE_KEY = `pragma.terminal.scrollback.v1.${getWindowScope()}`;
const MAX_LINES = 1000;
const SAVE_INTERVAL_MS = 15_000;

function loadSaved(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

// Read once at startup, before the first save can overwrite it.
const pending = loadSaved();

/** Scrollback saved for a restored session, handed out once. */
export function takeTerminalScrollback(sessionId: string): string | null {
  const text = pending[sessionId];
  if (text === undefined) return null;
  delete pending[sessionId];
  return useSettingsStore.getState().terminal.restoreScrollback ? text : null;
}

export function saveTerminalScrollback(): void {
  if (!isWorkspaceWindow()) return;
  try {
    if (!useSettingsStore.getState().terminal.restoreScrollback) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const snapshot: Record<string, string> = {};
    for (const session of restorableTerminalState(useTerminalStore.getState()).sessions) {
      // Sessions that have not mounted yet keep the text they were restored with.
      const text = readTerminalOutput(session.id, MAX_LINES) ?? pending[session.id];
      if (text) snapshot[session.id] = text;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be full or unavailable; the next save tries again.
  }
}

let retainCount = 0;
let saveTimer: ReturnType<typeof setInterval> | null = null;

/** Saves scrollback periodically and on page hide while at least one terminal panel is mounted. */
export function retainScrollbackPersistence(): () => void {
  retainCount += 1;
  if (retainCount === 1) {
    window.addEventListener("pagehide", saveTerminalScrollback);
    saveTimer = setInterval(saveTerminalScrollback, SAVE_INTERVAL_MS);
  }
  return () => {
    retainCount -= 1;
    if (retainCount > 0) return;
    window.removeEventListener("pagehide", saveTerminalScrollback);
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = null;
  };
}
