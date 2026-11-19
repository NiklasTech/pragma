import type { KeyboardEvent } from "react";

const KEYBOARD_SELECTION_MS = 500;
let keyboardSelectionAt = Number.NEGATIVE_INFINITY;

/// Whether the focused tab was just selected with the keyboard, so its content leaves the focus there.
export function tabSelectedByKeyboard(): boolean {
  return (
    performance.now() - keyboardSelectionAt < KEYBOARD_SELECTION_MS &&
    document.activeElement?.getAttribute("role") === "tab"
  );
}

/// The tab an arrow, Home or End key moves to, wrapping at both ends; null for other keys.
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/// Keyboard for a `role="tablist"`: arrows, Home and End move to a tab and select it, Enter and
/// Space select the focused one. Keys typed into a field inside a tab, like a rename, are left alone.
export function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>): void {
  const target = event.target as HTMLElement;
  if (target.getAttribute("role") !== "tab") return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    keyboardSelectionAt = performance.now();
    target.click();
    return;
  }
  const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const next = nextTabIndex(event.key, tabs.indexOf(target), tabs.length);
  if (next === null) return;
  event.preventDefault();
  keyboardSelectionAt = performance.now();
  tabs[next].focus();
  tabs[next].click();
}
