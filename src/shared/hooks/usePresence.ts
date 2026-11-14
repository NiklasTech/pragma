import { useEffect, useState } from "react";

export interface Presence {
  /** Rendered: true from opening until the exit transition has run. */
  mounted: boolean;
  /** In its open state; false on the first frame so the enter transition can run. */
  shown: boolean;
}

/** Keeps an element mounted while it transitions in and out. */
export function usePresence(open: boolean, exitMs: number): Presence {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames: the first paints the closed state, the second starts the transition from it.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, shown };
}
