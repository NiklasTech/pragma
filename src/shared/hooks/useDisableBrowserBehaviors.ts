import { useEffect } from "react";

function isDevToolsShortcut(event: KeyboardEvent): boolean {
  const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
  const isMac = navigator.platform.toLowerCase().includes("mac");

  if (key === "F12") return true;

  const match = (mod: boolean, secondary: boolean, expected: string): boolean =>
    mod && secondary && key.toLowerCase() === expected.toLowerCase();

  if (isMac) {
    return (
      match(metaKey, altKey, "i") ||
      match(metaKey, altKey, "j") ||
      match(metaKey, altKey, "c") ||
      match(metaKey, shiftKey, "c")
    );
  }

  return (
    match(ctrlKey, shiftKey, "i") || match(ctrlKey, shiftKey, "j") || match(ctrlKey, shiftKey, "c")
  );
}

function isBrowserContextMenuShortcut(event: KeyboardEvent): boolean {
  return event.key === "F10" && event.shiftKey;
}

export function useDisableBrowserBehaviors(): void {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isDevToolsShortcut(event) || isBrowserContextMenuShortcut(event)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
