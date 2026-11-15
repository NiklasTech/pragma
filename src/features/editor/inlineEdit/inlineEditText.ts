import type { Text } from "@codemirror/state";

import type { AIProvider, AIState } from "@/shared/stores/ai/types";

/// The whole lines a selection touches; an empty selection is its line. A selection ending at a line start leaves that line out.
export function wholeLineRange(doc: Text, from: number, to: number): { from: number; to: number } {
  const first = doc.lineAt(from);
  let last = doc.lineAt(to);
  if (to > from && to === last.from && last.number > first.number) last = doc.line(last.number - 1);
  return { from: first.from, to: last.to };
}

function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

function lines(count: number): string {
  return count === 1 ? "1 line" : `${count} lines`;
}

/// How the edit changes the code, in a few words.
export function changeSummary(before: string, after: string): string {
  if (before === after) return "Nothing to change";
  const old = lineCount(before);
  const next = lineCount(after);
  if (next === 0) return `Removes ${lines(old)}`;
  if (old === next) return `${lines(old)} change`;
  return `${lines(old)} become ${next}`;
}

export interface InlineEditModel {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
}

/// The model that makes inline edits: the active one, when it has what it needs to run.
export function inlineEditModel(
  state: Pick<AIState, "activeProvider" | "activeModel" | "providers" | "apiKeyRefs">,
): InlineEditModel | null {
  const provider = state.activeProvider;
  const config = state.providers[provider];
  if (!state.activeModel) return null;
  const ready =
    provider === "ollama"
      ? true
      : provider === "custom"
        ? Boolean(config.baseUrl)
        : state.apiKeyRefs[provider] !== null;
  if (!ready) return null;
  return { provider, model: state.activeModel, baseUrl: config.baseUrl || undefined };
}
