export function trimHomePrompt(raw: string): string {
  return raw.trim();
}

export function isHomePromptSubmitKey(event: Pick<KeyboardEvent, "key" | "shiftKey">): boolean {
  return event.key === "Enter" && !event.shiftKey;
}
