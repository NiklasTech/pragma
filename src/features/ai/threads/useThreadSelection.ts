import { useCallback, useState } from "react";

/// Ids from the anchor to the target in list order, both inclusive.
export function rangeBetween(order: string[], anchor: string | null, target: string): string[] {
  const end = order.indexOf(target);
  if (end === -1) return [];
  const start = anchor ? order.indexOf(anchor) : -1;
  if (start === -1) return [target];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function useThreadSelection(order: string[]) {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setActive(true);
    setAnchor(id);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const extendTo = useCallback(
    (id: string, fallbackAnchor: string | null) => {
      setActive(true);
      setAnchor(id);
      setPicked(
        (current) => new Set([...current, ...rangeBetween(order, anchor ?? fallbackAnchor, id)]),
      );
    },
    [anchor, order],
  );

  const start = useCallback(() => setActive(true), []);
  const selectAll = useCallback(() => setPicked(new Set(order)), [order]);
  const clear = useCallback(() => setPicked(new Set()), []);
  const exit = useCallback(() => {
    setActive(false);
    setPicked(new Set());
    setAnchor(null);
  }, []);

  return { active, picked, toggle, extendTo, start, selectAll, clear, exit };
}
