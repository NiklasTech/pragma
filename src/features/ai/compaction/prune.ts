import { isToolUIPart, type UIMessage } from "ai";

const KEEP_RECENT_TOOL_OUTPUTS = 6;
const MIN_PRUNED_OUTPUT_CHARS = 2000;

function serialize(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

export function prunedOutputPlaceholder(chars: number): string {
  return `[Output of ${chars} characters removed to save context. Run the tool again if you need it.]`;
}

/// Replaces large tool outputs, except the most recent ones, with a short placeholder.
export function pruneToolOutputs(messages: UIMessage[]): {
  messages: UIMessage[];
  removedChars: number;
} {
  const result = [...messages];
  let seen = 0;
  let removedChars = 0;

  for (let i = result.length - 1; i >= 0; i -= 1) {
    const parts = [...result[i].parts];
    let changed = false;
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      seen += 1;
      if (seen <= KEEP_RECENT_TOOL_OUTPUTS) continue;
      const output = serialize(part.output);
      if (output.length < MIN_PRUNED_OUTPUT_CHARS) continue;
      const placeholder = prunedOutputPlaceholder(output.length);
      parts[j] = { ...part, output: placeholder };
      removedChars += output.length - placeholder.length;
      changed = true;
    }
    if (changed) result[i] = { ...result[i], parts };
  }

  return { messages: result, removedChars };
}

function messageChars(message: UIMessage): number {
  let chars = 0;
  for (const part of message.parts) {
    if (part.type === "text" || part.type === "reasoning") chars += part.text.length;
    else if (isToolUIPart(part)) {
      chars += serialize(part.input).length;
      if (part.state === "output-available") chars += serialize(part.output).length;
      if (part.state === "output-error") chars += part.errorText.length;
    }
  }
  return chars;
}

/// A rough token count, about four characters per token.
export function estimateTokens(messages: UIMessage[]): number {
  return Math.ceil(messages.reduce((sum, message) => sum + messageChars(message), 0) / 4);
}
