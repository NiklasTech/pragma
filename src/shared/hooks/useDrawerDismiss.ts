import { useEffect, type RefObject } from "react";

// Clicks inside menus, dialogs and toasts a drawer opened must not close it.
const KEEP_OPEN_SELECTOR =
  "[data-drawer-toggle], [role='menu'], [role='dialog'], [role='listbox'], [data-sonner-toaster]";

/** Closes an open drawer on Escape or a press outside it and its toggle buttons. */
export function useDrawerDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (ref.current?.contains(target) || target.closest(KEEP_OPEN_SELECTOR)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) close();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open, ref]);
}
