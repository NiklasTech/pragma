const EDITABLE_SELECTOR = "input, textarea, [contenteditable]:not([contenteditable='false'])";
const SELF_SELECTING_SELECTOR = `${EDITABLE_SELECTOR}, .cm-editor, .xterm`;
const SELECTABLE_REGION_SELECTOR = ".select-text";

type ShortcutKeys = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

export function isSelectAllShortcut(event: ShortcutKeys, isMac: boolean): boolean {
  const mod = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "a";
}

function toElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

/** Editors, text fields and terminals handle Select All themselves. */
export function handlesOwnSelectAll(target: EventTarget | null): boolean {
  return Boolean(toElement(target)?.closest(SELF_SELECTING_SELECTOR));
}

export function findSelectableRegion(target: EventTarget | null): Element | null {
  return toElement(target)?.closest(SELECTABLE_REGION_SELECTOR) ?? null;
}

export function selectNodeContents(node: Node): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

async function selectAllInEditor(editorElement: HTMLElement): Promise<void> {
  const [{ EditorView }, { selectAll }] = await Promise.all([
    import("@codemirror/view"),
    import("@codemirror/commands"),
  ]);
  const view = EditorView.findFromDOM(editorElement);
  if (!view) return;
  view.focus();
  selectAll(view);
}

/** Selects the content of the editor, field or content region that contains the target. */
export function selectAllWithin(target: EventTarget | null): void {
  const element = toElement(target);
  if (!element) return;

  const editor = element.closest<HTMLElement>(".cm-editor");
  if (editor) {
    void selectAllInEditor(editor);
    return;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.select();
    return;
  }

  const editable = element.closest<HTMLElement>(EDITABLE_SELECTOR);
  if (editable) {
    editable.focus();
    selectNodeContents(editable);
    return;
  }

  const region = findSelectableRegion(element);
  if (region) selectNodeContents(region);
}
