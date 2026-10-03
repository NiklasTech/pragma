import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { callExtension } from "./calls";
import { asRecord } from "./params";
import { providersFor, useExtensionsStore } from "./store";

const COMPLETION_TIMEOUT_MS = 1500;
const MAX_ITEMS = 200;
const MAX_DOCUMENT_CHARS = 1024 * 1024;
const WORD_BEFORE_CURSOR = /[\w$-]*$/;
const VALID_WHILE_TYPING = /^[\w$-]*$/;
const KINDS = new Set([
  "text",
  "keyword",
  "variable",
  "function",
  "method",
  "class",
  "interface",
  "property",
  "constant",
  "type",
  "enum",
  "namespace",
]);

export interface ExtensionCompletionItem {
  label: string;
  insertText?: string;
  detail?: string;
  kind?: string;
}

export function validateCompletionItems(value: unknown): ExtensionCompletionItem[] {
  if (!Array.isArray(value)) return [];
  const items: ExtensionCompletionItem[] = [];
  for (const entry of value.slice(0, MAX_ITEMS)) {
    const record = asRecord(entry);
    if (!record || typeof record.label !== "string" || !record.label) continue;
    const item: ExtensionCompletionItem = { label: record.label };
    if (typeof record.insertText === "string") item.insertText = record.insertText;
    if (typeof record.detail === "string") item.detail = record.detail;
    if (typeof record.kind === "string" && KINDS.has(record.kind)) item.kind = record.kind;
    items.push(item);
  }
  return items;
}

/// One CodeMirror source that asks the extensions' completion providers for the language.
export function extensionCompletionSource(language: string, filePath: string): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const providers = providersFor(useExtensionsStore.getState().completionProviders, language);
    if (providers.length === 0) return null;

    const word = context.matchBefore(WORD_BEFORE_CURSOR);
    const typed = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos);
    const triggered = providers.filter((provider) => provider.triggerCharacters.includes(typed));
    const typing = word !== null && word.from !== word.to;
    if (!typing && !context.explicit && triggered.length === 0) return null;
    if (context.state.doc.length > MAX_DOCUMENT_CHARS) return null;

    const line = context.state.doc.lineAt(context.pos);
    const request = {
      document: { path: filePath, language, text: context.state.doc.toString() },
      line: line.number,
      column: context.pos - line.from + 1,
      prefix: word ? context.state.sliceDoc(word.from, word.to) : "",
      triggerCharacter: triggered.length > 0 ? typed : null,
    };
    const asked = typing || context.explicit ? providers : triggered;
    const results = await Promise.all(
      asked.map((provider) =>
        callExtension(
          provider.extensionId,
          "completion.provide",
          { providerId: provider.id, ...request },
          COMPLETION_TIMEOUT_MS,
        )
          .then(validateCompletionItems)
          .catch(() => []),
      ),
    );
    if (context.aborted) return null;
    const options = results.flat().map((item) => ({
      label: item.label,
      detail: item.detail,
      type: item.kind ?? "text",
      apply: item.insertText ?? item.label,
    }));
    if (options.length === 0) return null;
    return { from: word?.from ?? context.pos, options, validFor: VALID_WHILE_TYPING };
  };
}
