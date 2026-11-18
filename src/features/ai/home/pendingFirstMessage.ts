let pending: string | null = null;

export function setPendingFirstMessage(text: string): void {
  pending = text;
}

export function takePendingFirstMessage(): string | null {
  const text = pending;
  pending = null;
  return text;
}

export function clearPendingFirstMessage(): void {
  pending = null;
}
