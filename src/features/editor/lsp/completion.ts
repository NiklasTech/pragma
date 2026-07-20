import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

import {
  lspCompletion,
  lspCompletionResolve,
  type LspCompletionItem,
  type LspFeatureFlags,
} from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { renderMarkdownToDom } from "./markdown-lite";
import "./completion-icons.css";

const WORD_BEFORE_CURSOR = /[\w$-]*$/;
const VALID_WHILE_TYPING = /^[\w$-]*$/;

// LSP CompletionItemKind (1-25) -> CodeMirror completion type
const KIND_TO_TYPE: Record<number, string> = {
  1: "text",
  2: "method",
  3: "function",
  4: "function",
  5: "property",
  6: "variable",
  7: "class",
  8: "interface",
  9: "namespace",
  10: "property",
  11: "constant",
  12: "constant",
  13: "enum",
  14: "keyword",
  15: "text",
  16: "constant",
  17: "text",
  18: "type",
  19: "namespace",
  20: "enum",
  21: "constant",
  22: "class",
  23: "function",
  24: "type",
  25: "type",
};

export function mapCompletionItem(item: LspCompletionItem): Completion {
  return {
    label: item.label,
    type: KIND_TO_TYPE[item.kind ?? 1] ?? "text",
    detail: item.detail,
    sortText: item.sortText ?? item.label,
    apply: item.insertText ?? item.label,
  };
}

export function documentationToText(documentation: unknown): string | null {
  if (typeof documentation === "string") {
    return documentation.length > 0 ? documentation : null;
  }
  if (documentation !== null && typeof documentation === "object" && "value" in documentation) {
    const value = (documentation as { value: unknown }).value;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

async function buildInfoDom(
  language: string,
  filePath: string,
  item: LspCompletionItem,
  resolveSupported: boolean,
): Promise<Node | null> {
  let text = documentationToText(item.documentation);
  if (!text && resolveSupported) {
    try {
      const resolved = await lspCompletionResolve(language, filePath, item);
      text = documentationToText(resolved.documentation) ?? resolved.detail ?? null;
    } catch {
      text = null;
    }
  }
  if (!text) {
    return null;
  }
  const dom = renderMarkdownToDom(text);
  dom.classList.add("cm-lsp-completion-doc");
  return dom;
}

export function createLspCompletionSource(
  language: string,
  filePath: string,
  flags: LspFeatureFlags,
): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const word = context.matchBefore(WORD_BEFORE_CURSOR);
    if (word === null || (word.from === word.to && !context.explicit)) {
      const typed = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos);
      if (!flags.completionTriggerCharacters.includes(typed)) {
        return null;
      }
    }

    const line = context.state.doc.lineAt(context.pos);
    await flushLspDocumentSync(language, filePath, context.state.doc.toString()).catch(() => {});
    if (context.aborted) {
      return null;
    }
    const items = await lspCompletion(language, filePath, line.number - 1, context.pos - line.from);
    if (context.aborted || items.length === 0) {
      return null;
    }

    return {
      from: word?.from ?? context.pos,
      options: items.map((item) => {
        const completion = mapCompletionItem(item);
        completion.info = () => buildInfoDom(language, filePath, item, flags.completionResolve);
        return completion;
      }),
      validFor: VALID_WHILE_TYPING,
    };
  };
}

export function lspCompletionExtension(
  language: string,
  filePath: string,
  flags: LspFeatureFlags,
): Extension {
  return autocompletion({
    override: [createLspCompletionSource(language, filePath, flags)],
    activateOnTyping: true,
    maxRenderedOptions: 100,
  });
}
