import type { Terminal } from "@xterm/xterm";

/// The part of a WebKit dead-key cancel keypress that xterm drops, or null when the event is not one.
export function droppedDeadKeyText(committed: string | null, key: string): string | null {
  if (!committed || key.length <= committed.length || !key.startsWith(committed)) return null;
  return key.slice(committed.length);
}

/// WebKit cancels a dead key (e.g. "~" then "/") with one keypress whose key holds both
/// characters; xterm repeats the dead key and drops the rest (xterm.js#5894).
export function fixWebKitDeadKeys(term: Terminal, container: HTMLElement): () => void {
  let committed: string | null = null;

  const onCompositionEnd = (event: CompositionEvent) => {
    committed = event.data;
  };
  const onKeyPress = (event: KeyboardEvent) => {
    const dropped = droppedDeadKeyText(committed, event.key);
    committed = null;
    if (dropped === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    term.input(dropped);
  };

  // Capture on the container so this runs before xterm's own textarea listeners.
  container.addEventListener("compositionend", onCompositionEnd, true);
  container.addEventListener("keypress", onKeyPress, true);
  return () => {
    container.removeEventListener("compositionend", onCompositionEnd, true);
    container.removeEventListener("keypress", onKeyPress, true);
  };
}
