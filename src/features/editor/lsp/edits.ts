import type { ChangeSpec, Text } from "@codemirror/state";

import type { LspTextEdit } from "./client";

export type { LspTextEdit };

export function offsetFromLspPosition(text: string, line: number, character: number): number {
  let currentLine = 0;
  let lineStart = 0;
  while (currentLine < line) {
    const newline = text.indexOf("\n", lineStart);
    if (newline === -1) {
      return text.length;
    }
    lineStart = newline + 1;
    currentLine += 1;
  }
  return Math.min(lineStart + character, text.length);
}

export function lspTextEditsToChangeSpec(doc: Text, edits: LspTextEdit[]): ChangeSpec[] {
  const content = doc.toString();
  return edits
    .map((edit) => ({
      from: offsetFromLspPosition(content, edit.range.start.line, edit.range.start.character),
      to: offsetFromLspPosition(content, edit.range.end.line, edit.range.end.character),
      insert: edit.newText,
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to);
}

export function applyEditsToContent(content: string, edits: LspTextEdit[]): string {
  const changes = edits
    .map((edit) => ({
      from: offsetFromLspPosition(content, edit.range.start.line, edit.range.start.character),
      to: offsetFromLspPosition(content, edit.range.end.line, edit.range.end.character),
      insert: edit.newText,
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to);

  let result = content;
  for (const change of changes) {
    result = result.slice(0, change.from) + change.insert + result.slice(change.to);
  }
  return result;
}
