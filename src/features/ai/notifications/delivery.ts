import type { UiMode } from "@/shell/mode";

export type AttentionDelivery = "none" | "card" | "system";

export interface DeliveryInput {
  /** Whether this kind of event notifies at all; a waiting agent always does. */
  enabled: boolean;
  windowFocused: boolean;
  sessionInView: boolean;
  card: boolean;
  system: boolean;
}

/// A system notification while Pragma is in the background, a card while the session is out of view.
export function resolveAttentionDelivery(input: DeliveryInput): AttentionDelivery {
  if (!input.enabled) return "none";
  if (!input.windowFocused) return input.system ? "system" : "none";
  if (input.sessionInView || !input.card) return "none";
  return "card";
}

export interface ViewState {
  uiMode: UiMode;
  boardOpen: boolean;
  focusedSessionId: string | null;
}

/// Only the session in the focused pane of the Agents view counts as looked at.
export function isSessionInView(sessionId: string, view: ViewState): boolean {
  return view.uiMode === "agents" && !view.boardOpen && view.focusedSessionId === sessionId;
}
