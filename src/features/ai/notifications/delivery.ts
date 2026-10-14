import type { UiMode } from "@/shell/mode";

export type AttentionDelivery = "none" | "popup" | "system";

export interface DeliveryInput {
  enabled: boolean;
  windowFocused: boolean;
  sessionInView: boolean;
  inAppPopups: boolean;
}

/// A system notification while Pragma is in the background, a popup while the session is out of view.
export function resolveAttentionDelivery(input: DeliveryInput): AttentionDelivery {
  if (!input.enabled) return "none";
  if (!input.windowFocused) return "system";
  if (input.sessionInView || !input.inAppPopups) return "none";
  return "popup";
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
