import { useLayoutStore } from "@/shell/layout";
import { findPanelByKind } from "@/shell/layout/tree/operations";

/** First docked terminal panel in the layout tree, if any. */
export function resolveDefaultTerminalPanelId(): string | undefined {
  return findPanelByKind(useLayoutStore.getState().root, "terminal")?.id;
}
