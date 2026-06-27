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
