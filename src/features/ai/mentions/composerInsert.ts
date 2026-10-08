import { useEffect, type RefObject } from "react";
import { create } from "zustand";

interface ComposerInsertState {
  /** Text waiting for the focused session's composer to pick it up. */
  pending: string | null;
  insert: (text: string) => void;
  consume: () => string | null;
}

export const useComposerInsertStore = create<ComposerInsertState>((set, get) => ({
  pending: null,
  insert: (text) => {
    const { pending } = get();
    set({ pending: pending ? `${pending} ${text}` : text });
  },
  consume: () => {
    const { pending } = get();
    if (pending !== null) set({ pending: null });
    return pending;
  },
}));

/// Appends `text` after the draft with a separating space and leaves a space to keep typing.
export function appendToDraft(draft: string, text: string): string {
  const separator = draft.length > 0 && !/\s$/.test(draft) ? " " : "";
  return `${draft}${separator}${text} `;
}

export function useComposerInsert(
  inputRef: RefObject<string>,
  onInputChange: (value: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
): void {
  const pending = useComposerInsertStore((state) => state.pending);

  useEffect(() => {
    if (!pending) return;
    const text = useComposerInsertStore.getState().consume();
    if (!text) return;
    const next = appendToDraft(inputRef.current, text);
    onInputChange(next);
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    requestAnimationFrame(() => textarea.setSelectionRange(next.length, next.length));
  }, [pending, inputRef, onInputChange, textareaRef]);
}
