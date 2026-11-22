export interface TerminalSuggestionEventDetail {
  suggestion: string;
  visible: boolean;
}

export interface TerminalSelectionEventDetail {
  selection: string;
}

export const TERMINAL_SUGGESTION_EVENT = "pragma:terminal:suggestion";
export const TERMINAL_SELECTION_EVENT = "pragma:terminal:selection";
export const TERMINAL_ACCEPT_SUGGESTION_EVENT = "pragma:terminal:acceptSuggestion";
export const TERMINAL_DISMISS_SUGGESTION_EVENT = "pragma:terminal:dismissSuggestion";
export const TERMINAL_CLEAR_EVENT = "pragma:terminal:clear";
export const TERMINAL_COPY_OUTPUT_EVENT = "pragma:terminal:copyOutput";
export const TERMINAL_FIND_EVENT = "pragma:terminal:find";

export function dispatchTerminalSuggestion(detail: TerminalSuggestionEventDetail): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_SUGGESTION_EVENT, { detail }));
}

export function dispatchTerminalSelection(selection: string): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_SELECTION_EVENT, { detail: { selection } }));
}

export function acceptTerminalSuggestion(): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_ACCEPT_SUGGESTION_EVENT));
}

export function dismissTerminalSuggestion(): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_DISMISS_SUGGESTION_EVENT));
}

/** Names the terminal session a header button acts on. */
export interface TerminalTargetEventDetail {
  sessionId: string;
}

export function dispatchTerminalClear(sessionId: string): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_CLEAR_EVENT, { detail: { sessionId } }));
}

export function dispatchTerminalCopyOutput(sessionId: string): void {
  window.dispatchEvent(new CustomEvent(TERMINAL_COPY_OUTPUT_EVENT, { detail: { sessionId } }));
}

/** True when keyboard focus is inside a terminal marked with `data-terminal-find`. */
export function isTerminalFindFocused(): boolean {
  return document.activeElement?.closest("[data-terminal-find]") != null;
}

/** Without a session the find bar opens in the terminal that has focus. */
export function dispatchTerminalFind(sessionId?: string): void {
  window.dispatchEvent(
    new CustomEvent(TERMINAL_FIND_EVENT, { detail: sessionId ? { sessionId } : undefined }),
  );
}

/** The editor terminal session under a right-click, from the attribute its root carries. */
export function terminalSessionAt(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const root = target.closest<HTMLElement>("[data-terminal-session]");
  return root?.dataset.terminalSession ?? null;
}
