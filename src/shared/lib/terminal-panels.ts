import { useLayoutStore } from "@/shell/layout";
import { findPanelByKind } from "@/shell/layout/tree/operations";

/** First docked terminal panel in the layout tree, if any. */
export function resolveDefaultTerminalPanelId(): string | undefined {
  return findPanelByKind(useLayoutStore.getState().root, "terminal")?.id;
}

/** Ignore stale activeByPanel ids that no longer belong to this panel. */
export function resolvePanelActiveSessionId(
  sessionIds: string[],
  storedId: string | undefined,
): string | null {
  if (storedId && sessionIds.includes(storedId)) return storedId;
  return sessionIds[sessionIds.length - 1] ?? null;
}
