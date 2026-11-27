import type { BackendToolCall, BackendToolDetails } from "./protocol";

/** What a tool part keeps of a coding CLI's file changes and files. */
export type ToolMetadata = {
  diffs?: { path: string; old_text: string | null; new_text: string }[];
  locations?: { path: string; line: number | null }[];
};

export interface ToolCallInput {
  type: "tool-input-available";
  toolCallId: string;
  toolName: string;
  input: unknown;
  title?: string;
  toolMetadata?: ToolMetadata;
}

export interface ToolCallOutput {
  type: "tool-output-available";
  toolCallId: string;
  output: unknown;
  toolMetadata: ToolMetadata;
}

interface TrackedCall {
  input: ToolCallInput;
  /** The result once the call finished; `null` for a failed call. */
  output?: unknown;
}

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function hasFiles(details: BackendToolDetails | undefined): boolean {
  return Boolean(details?.diffs?.length || details?.locations?.length);
}

/// File changes and files of a call; a report without them keeps the ones it had.
function mergeMetadata(
  previous: ToolMetadata | undefined,
  details: BackendToolDetails | undefined,
): ToolMetadata | undefined {
  if (!hasFiles(details)) return previous;
  const metadata: ToolMetadata = { ...previous };
  if (details?.diffs?.length) {
    metadata.diffs = details.diffs.map((diff) => ({
      path: diff.path,
      old_text: diff.old_text,
      new_text: diff.new_text,
    }));
  }
  if (details?.locations?.length) {
    metadata.locations = details.locations.map((location) => ({
      path: location.path,
      line: location.line,
    }));
  }
  return metadata;
}

/// Merges the reports of one stream's tool calls. Coding CLIs report a call first and refine
/// it once its input is complete; a refinement may leave out the name, input or title, and
/// the final file change of an edit may come after its result.
export class ToolCallTracker {
  private readonly calls = new Map<string, TrackedCall>();

  /// The chunk that shows this report, or null when nothing new would show.
  report(
    call: BackendToolCall | null,
    details: BackendToolDetails | undefined,
  ): ToolCallInput | ToolCallOutput | null {
    const id = call?.id ?? details?.tool_call_id;
    if (!id) return null;
    const known = this.calls.get(id);

    if (known && "output" in known) {
      const toolMetadata = mergeMetadata(known.input.toolMetadata, details);
      if (!toolMetadata || known.output === null || !hasFiles(details)) return null;
      known.input = { ...known.input, toolMetadata };
      return { type: "tool-output-available", toolCallId: id, output: known.output, toolMetadata };
    }

    // The first name stays: agents without a tool name send their changing title instead.
    const toolName = known?.input.toolName || call?.function.name;
    if (!toolName) return null;
    const args = call?.function.arguments;
    const toolMetadata = mergeMetadata(known?.input.toolMetadata, details);
    const title = details?.title ?? known?.input.title;
    const next: ToolCallInput = {
      type: "tool-input-available",
      toolCallId: id,
      toolName,
      input: args ? parseArguments(args) : known?.input.input,
      ...(title ? { title } : {}),
      ...(toolMetadata ? { toolMetadata } : {}),
    };
    this.calls.set(id, { input: next });
    return next;
  }

  /// A finished call keeps its input; later reports only add file changes to it.
  finish(toolCallId: string, output: unknown): void {
    const known = this.calls.get(toolCallId);
    if (known) known.output = output;
    else this.calls.set(toolCallId, { input: emptyInput(toolCallId), output: null });
  }
}

function emptyInput(toolCallId: string): ToolCallInput {
  return { type: "tool-input-available", toolCallId, toolName: "", input: undefined };
}
