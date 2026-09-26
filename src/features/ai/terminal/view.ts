interface TerminalView {
  clear: () => void;
  copy: () => void;
}

const views = new Map<string, TerminalView>();

export function registerTerminalView(sessionId: string, view: TerminalView): () => void {
  views.set(sessionId, view);
  return () => {
    if (views.get(sessionId) === view) views.delete(sessionId);
  };
}

export function clearTerminalView(sessionId: string): void {
  views.get(sessionId)?.clear();
}

export function copyTerminalView(sessionId: string): void {
  views.get(sessionId)?.copy();
}
