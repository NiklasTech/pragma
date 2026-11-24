import { collectLeaves } from "./layout";
import type { PaneRoot } from "./operations";

interface TabFocus {
  root: PaneRoot;
  focusedSessionId: string | null;
  /** Sessions by how recently they were focused. */
  focusOrder: readonly string[];
}

/**
 * The session whose chat stays live in a tab: the focused one, else the chat used last, so a
 * terminal beside it never takes its place. A tab without a chat falls back to the focused session.
 */
export function chatSessionFor(
  { root, focusedSessionId, focusOrder }: TabFocus,
  isChat: (sessionId: string) => boolean,
): string | null {
  if (focusedSessionId && isChat(focusedSessionId)) return focusedSessionId;
  const shown = collectLeaves(root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : []));
  return (
    focusOrder.find((id) => shown.includes(id) && isChat(id)) ??
    shown.find(isChat) ??
    focusedSessionId
  );
}
