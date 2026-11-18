export interface NativeMenuPayload {
  action: string;
  path?: string;
}

export function guardedDispatch(
  last: Map<string, number>,
  id: string,
  fn: () => void,
  windowMs = 80,
): void {
  const now = Date.now();
  const previous = last.get(id);
  if (previous !== undefined && now - previous < windowMs) return;
  last.set(id, now);
  fn();
}

export function wrapWithGuard<K extends string>(
  actions: Partial<Record<K, () => void>>,
  last: Map<string, number>,
  windowMs = 80,
): Partial<Record<K, () => void>> {
  const next: Partial<Record<K, () => void>> = {};
  for (const [id, fn] of Object.entries(actions) as [K, (() => void) | undefined][]) {
    if (!fn) continue;
    next[id] = () => guardedDispatch(last, id, fn, windowMs);
  }
  return next;
}
