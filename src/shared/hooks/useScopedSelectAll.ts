import { useEffect } from "react";
import {
  findSelectableRegion,
  handlesOwnSelectAll,
  isSelectAllShortcut,
  selectNodeContents,
} from "@/shared/lib/textSelection";

const IS_MAC = navigator.platform.toLowerCase().includes("mac");

function targetsWholeDocument(target: EventTarget | null): boolean {
  return target === document.body || target === document.documentElement;
}

/** Limits Select All to the focused content area instead of the whole UI. */
export function useScopedSelectAll(): void {
  useEffect(() => {
    let lastPointerTarget: EventTarget | null = null;

    const onPointerDown = (event: PointerEvent) => {
      lastPointerTarget = event.target;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isSelectAllShortcut(event, IS_MAC)) return;
      if (handlesOwnSelectAll(event.target)) return;
      event.preventDefault();
      const region = findSelectableRegion(lastPointerTarget);
      if (region?.isConnected) selectNodeContents(region);
    };

    // The native Edit > Select All menu item selects the whole document, starting at the body.
    const onSelectStart = (event: Event) => {
      if (targetsWholeDocument(event.target)) event.preventDefault();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("selectstart", onSelectStart);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("selectstart", onSelectStart);
    };
  }, []);
}
