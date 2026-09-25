export const HOME_PROMPT_EMPTY_LABEL = "New thread";
export const HOME_PROMPT_READY_LABEL = "Start";

export type HomePromptLabel = typeof HOME_PROMPT_EMPTY_LABEL | typeof HOME_PROMPT_READY_LABEL;

export function trimHomePrompt(raw: string): string {
  return raw.trim();
}

export function isHomePromptEmpty(raw: string): boolean {
  return trimHomePrompt(raw).length === 0;
}

export function homePromptLabel(raw: string): HomePromptLabel {
  return isHomePromptEmpty(raw) ? HOME_PROMPT_EMPTY_LABEL : HOME_PROMPT_READY_LABEL;
}

export function isHomePromptSubmitKey(event: Pick<KeyboardEvent, "key" | "shiftKey">): boolean {
  return event.key === "Enter" && !event.shiftKey;
}
