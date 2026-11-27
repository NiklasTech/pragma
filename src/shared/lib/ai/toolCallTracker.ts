import type { BackendToolCall } from "./protocol";

export interface ToolCallInput {
  toolCallId: string;
  toolName: string;
  input: unknown;
  title?: string;
}

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/// Merges the reports of one stream's tool calls. Coding CLIs report a call first and refine
/// it once its input is complete; a refinement may leave out the name, input or title.
export class ToolCallTracker {
  private readonly calls = new Map<string, ToolCallInput>();
  private readonly finished = new Set<string>();

  /// The call with this report merged in, or null when nothing new would show.
  update(call: BackendToolCall, title: string | undefined): ToolCallInput | null {
    if (this.finished.has(call.id)) return null;
    const known = this.calls.get(call.id);
    // The first name stays: agents without a tool name send their changing title instead.
    const toolName = known?.toolName || call.function.name;
    if (!toolName) return null;

    const next: ToolCallInput = {
      toolCallId: call.id,
      toolName,
      input: call.function.arguments ? parseArguments(call.function.arguments) : known?.input,
      title: title ?? known?.title,
    };
    this.calls.set(call.id, next);
    return next;
  }

  /// A finished call keeps its input; later reports must not reopen it.
  finish(toolCallId: string): void {
    this.finished.add(toolCallId);
  }
}
