import { type EditorView, type KeyBinding } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useEditorStore } from "@/shared/stores/editor";
import { lspDefinition, type LspDefinitionTarget } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { getLspFeatureFlags } from "./lspFlags";

const PEEK_RADIUS = 8;

interface FileReadResult {
  content: string;
}

export interface PeekLine {
  number: number;
  text: string;
}

export interface PeekSlice {
  lines: PeekLine[];
  highlightIndex: number;
}

export function slicePeekLines(content: string, line: number, radius = PEEK_RADIUS): PeekSlice {
  const allLines = content.length === 0 ? [""] : content.split("\n");
  const target = Math.min(Math.max(line, 0), allLines.length - 1);
  const start = Math.max(0, target - radius);
  const end = Math.min(allLines.length - 1, target + radius);

  const lines: PeekLine[] = [];
  for (let index = start; index <= end; index += 1) {
    lines.push({ number: index + 1, text: allLines[index] });
  }

  return { lines, highlightIndex: target - start };
}

let openOverlay: HTMLElement | null = null;
let openCleanup: (() => void) | null = null;

function closePeek(view: EditorView | null): void {
  openCleanup?.();
  openCleanup = null;
  openOverlay?.remove();
  openOverlay = null;
  view?.focus();
}

async function readPeekContent(
  targetFilePath: string,
  currentFilePath: string,
  currentContent: string,
): Promise<string> {
  if (targetFilePath === currentFilePath) {
    return currentContent;
  }
  const tab = useEditorStore
    .getState()
    .tabs.find((candidate) => candidate.kind === "file" && candidate.path === targetFilePath);
  if (tab && tab.kind === "file") {
    return tab.content;
  }
  const result = await invoke<FileReadResult>("read_text_file", { path: targetFilePath });
  return result.content;
}

function showPeekOverlay(
  view: EditorView,
  target: LspDefinitionTarget,
  content: string,
  coords?: { clientX: number; clientY: number },
): void {
  const slice = slicePeekLines(content, target.line);

  const overlay = document.createElement("div");
  overlay.className = "pragma-peek-definition";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Peek definition");
  overlay.style.cssText = [
    "position: fixed",
    "z-index: 60",
    "width: min(560px, 80vw)",
    "max-height: 40vh",
    "overflow: auto",
    "border: 1px solid var(--color-border-subtle, rgba(127,127,127,0.35))",
    "border-radius: 6px",
    "background: var(--color-bg-root, #1e1e1e)",
    "box-shadow: 0 10px 30px rgba(0,0,0,0.35)",
    "font-size: 12px",
  ].join("; ");

  const header = document.createElement("div");
  header.style.cssText =
    "display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--color-border-subtle, rgba(127,127,127,0.25));";

  const title = document.createElement("span");
  title.textContent = `${target.filePath}:${target.line + 1}:${target.character + 1}`;
  title.style.cssText =
    "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.85;";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Esc";
  closeButton.setAttribute("aria-label", "Close peek definition");
  closeButton.style.cssText =
    "border: 0; background: transparent; cursor: pointer; opacity: 0.7; font: inherit; color: inherit;";

  header.append(title, closeButton);

  const pre = document.createElement("pre");
  pre.style.cssText = "margin: 0; padding: 6px 0; font-family: inherit; line-height: 1.5;";
  slice.lines.forEach((entry, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 10px; padding: 0 10px; white-space: pre;";
    if (index === slice.highlightIndex) {
      row.style.background = "var(--color-bg-hover, rgba(127,127,127,0.18))";
    }
    const number = document.createElement("span");
    number.textContent = String(entry.number);
    number.style.cssText = "flex: 0 0 40px; text-align: right; opacity: 0.45;";
    const text = document.createElement("span");
    text.textContent = entry.text.length > 0 ? entry.text : " ";
    row.append(number, text);
    pre.append(row);
  });

  overlay.append(header, pre);
  document.body.append(overlay);

  const caret = view.coordsAtPos(view.state.selection.main.head);
  const anchorX = coords?.clientX ?? caret?.left ?? 80;
  const anchorY = (coords?.clientY ?? caret?.bottom ?? 120) + 8;
  const left = Math.max(8, Math.min(anchorX, window.innerWidth - overlay.offsetWidth - 8));
  const top = Math.max(8, Math.min(anchorY, window.innerHeight - overlay.offsetHeight - 8));
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePeek(view);
    }
  };
  const onPointerDown = (event: MouseEvent) => {
    if (!overlay.contains(event.target as Node)) {
      closePeek(null);
    }
  };
  const onScroll = () => closePeek(null);
  const onResize = () => closePeek(null);

  closeButton.addEventListener("click", () => closePeek(view));
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("mousedown", onPointerDown, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);

  openOverlay = overlay;
  openCleanup = () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("mousedown", onPointerDown, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
  };
}

export async function openPeekDefinitionAtCursor(
  view: EditorView,
  language: string,
  filePath: string,
): Promise<void> {
  if (getLspFeatureFlags(filePath)?.definition === false) {
    return;
  }

  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const lspLine = line.number - 1;
  const lspCharacter = head - line.from;

  closePeek(null);

  let target: LspDefinitionTarget | null;
  try {
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});
    target = await lspDefinition(language, filePath, lspLine, lspCharacter);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!target) {
    return;
  }

  let content: string;
  try {
    content = await readPeekContent(target.filePath, filePath, view.state.doc.toString());
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    return;
  }

  showPeekOverlay(view, target, content);
}

export function peekDefinitionKeyBinding(language: string, filePath: string): KeyBinding {
  return {
    key: "Alt-F12",
    run: (view) => {
      void openPeekDefinitionAtCursor(view, language, filePath);
      return true;
    },
  };
}
