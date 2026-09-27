import { useEffect, useRef, useState } from "react";

/// Counts whole seconds while `active` is true and keeps the final value afterwards.
export function useElapsedSeconds(active: boolean): number {
  const startRef = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return;
    }
    const start = startRef.current ?? Date.now();
    startRef.current = start;
    const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return seconds;
}
