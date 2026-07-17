import { EditorView, keymap } from "@codemirror/view";
import type { Extension, Text } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";

import { useEditorStore } from "@/shared/stores/editor";
import { detectLanguage } from "@/shared/lib/language";
import { lspDefinition } from "./client";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export function positionToLsp(doc: Text, pos: number): { line: number; character: number } {
  const line = doc.lineAt(pos);
  return { line: line.number - 1, character: pos - line.from };
}

export async function jumpToDefinition(
  language: string,
  filePath: string,
  line: number,
  character: number,
): Promise<void> {
  const target = await lspDefinition(language, filePath, line, character);
  if (!target) {
    return;
  }

  const store = useEditorStore.getState();
  const existing = store.tabs.find((tab) => tab.kind === "file" && tab.path === target.filePath);

  let tabId: string;
  if (existing) {
    tabId = existing.id;
    store.setActiveTab(tabId);
  } else {
    const result = await invoke<FileReadResult>("read_text_file", { path: target.filePath });
    store.openFile({
      id: result.path,
      path: result.path,
      name: result.name,
      content: result.content,
      originalContent: result.content,
      isModified: false,
      language: detectLanguage(result.name),
    });
    tabId = result.path;
  }

  store.goToPosition(tabId, { line: target.line + 1, column: target.character + 1 });
}

export function lspDefinitionExtension(language: string, filePath: string): Extension {
  const jump = (view: EditorView, pos: number): boolean => {
    const { line, character } = positionToLsp(view.state.doc, pos);
    void jumpToDefinition(language, filePath, line, character).catch(() => {});
    return true;
  };

  return [
    keymap.of([
      {
        key: "F12",
        run: (view) => jump(view, view.state.selection.main.head),
      },
    ]),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!(event.ctrlKey || event.metaKey) || event.button !== 0) {
          return false;
        }
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) {
          return false;
        }
        event.preventDefault();
        return jump(view, pos);
      },
    }),
  ];
}
