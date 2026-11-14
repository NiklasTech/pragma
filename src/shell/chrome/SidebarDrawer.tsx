import { useEffect, useRef } from "react";

import { usePresence } from "@/shared/hooks/usePresence";

import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "@/shell/layout/store";

import { SidebarContent } from "./Sidebar";

// Matches --motion-slow, so the drawer unmounts once it has slid out.
const SLIDE_MS = 250;

// Clicks inside menus, dialogs and toasts the drawer opened must not close it.
const KEEP_OPEN_SELECTOR =
  "[data-sidebar-toggle], [role='menu'], [role='dialog'], [role='listbox'], [data-sonner-toaster]";

/// The unpinned sidebar: a sheet over the workspace that closes on Escape or a click outside.
export function SidebarDrawer() {
  const sidebar = useLayoutStore((s) => s.sidebar);
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);
  const ref = useRef<HTMLDivElement>(null);
  const open = !sidebar.pinned && !sidebar.collapsed && sidebar.position !== "hidden";
  const { mounted, shown } = usePresence(open, SLIDE_MS);
  const fromRight = sidebar.position === "right";

  useEffect(() => {
    if (!open) return;
    const close = () => setSidebarCollapsed(true);
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
  }, [open, setSidebarCollapsed]);

  if (!mounted) return null;

  return (
    <aside
      ref={ref}
      aria-label="Sidebar"
      inert={!shown}
      style={{ width: sidebar.width }}
      className={cn(
        "absolute inset-y-0 z-40 max-w-[calc(100%-1rem)] overflow-hidden rounded-well bg-bg-sheet shadow-[var(--shadow-md)] ring-1 ring-border",
        "transition-[translate,opacity] duration-(--motion-slow) ease-(--motion-ease-out)",
        fromRight ? "right-1.5" : "left-1.5",
        shown
          ? "translate-x-0 opacity-100"
          : fromRight
            ? "translate-x-[calc(100%+0.75rem)] opacity-0"
            : "-translate-x-[calc(100%+0.75rem)] opacity-0",
      )}
    >
      <SidebarContent />
    </aside>
  );
}
