import { hoverTooltip } from "@codemirror/view";
import type { Extension, Text } from "@codemirror/state";

import { lspHover } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { positionToLsp } from "./definition";
import { renderMarkdownToDom } from "./markdown-lite";

export function lspToPosition(doc: Text, line: number, character: number): number {
  const clampedLine = doc.line(Math.min(line + 1, doc.lines));
  return Math.min(clampedLine.from + character, clampedLine.to);
}

export function lspHoverExtension(language: string, filePath: string): Extension {
  return hoverTooltip(async (view, pos) => {
    const { line, character } = positionToLsp(view.state.doc, pos);
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});

    let hover: Awaited<ReturnType<typeof lspHover>>;
    try {
      hover = await lspHover(language, filePath, line, character);
    } catch {
      return null;
    }
    if (!hover || hover.contents.length === 0) {
      return null;
    }

    const from = hover.range
      ? lspToPosition(view.state.doc, hover.range.start.line, hover.range.start.character)
      : (view.state.wordAt(pos)?.from ?? pos);
    const to = hover.range
      ? lspToPosition(view.state.doc, hover.range.end.line, hover.range.end.character)
      : (view.state.wordAt(pos)?.to ?? pos);

    return {
      pos: from,
      end: to,
      above: true,
      create: () => {
        const dom = renderMarkdownToDom(hover.contents);
        dom.classList.add("cm-lsp-hover-doc");
        return { dom };
      },
    };
  });
}
