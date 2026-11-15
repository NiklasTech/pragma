export interface EnterContext {
  key: string;
  composing: boolean;
  modified: boolean;
  /** The focus is in the same pane, or chat panel, as the request. */
  inScope: boolean;
  /** The focus is on a button, link or menu item, which answers Enter itself. */
  onControl: boolean;
  /** Text in the focused field; null when the focus is not in a text field. */
  fieldText: string | null;
}

/// Enter allows a request while the focus is in its pane and nothing typed would be lost.
export function enterApproves(context: EnterContext): boolean {
  if (context.key !== "Enter" || context.composing || context.modified) return false;
  if (!context.inScope || context.onControl) return false;
  return context.fieldText === null || context.fieldText.trim() === "";
}

function fieldText(target: Element): string | null {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return target.value;
  }
  // Rich editors keep their text elsewhere; never take Enter from them.
  return target instanceof HTMLElement && target.isContentEditable ? "typed" : null;
}

export function allowsEnterToApprove(event: KeyboardEvent, bar: HTMLElement | null): boolean {
  const target = event.target;
  if (!bar || event.defaultPrevented || !(target instanceof Element)) return false;
  const scope = bar.closest("[data-pane-leaf]") ?? bar.closest("[data-chat-panel]");
  return enterApproves({
    key: event.key,
    composing: event.isComposing,
    modified: event.shiftKey || event.altKey || event.metaKey || event.ctrlKey,
    inScope: scope !== null && scope.contains(target),
    onControl: target.closest("button, a, [role='menuitem']") !== null,
    fieldText: fieldText(target),
  });
}
