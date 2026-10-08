import type { IDecoration, IDisposable, IMarker, Terminal as XTerm } from "@xterm/xterm";
import { findJumpTarget, parseShellMark, readCommandOutput, readCommandText } from "./marks";

const OSC_SHELL_INTEGRATION = 133;

export interface FinishedCommand {
  command: string;
  exitCode: number | null;
  /** Only kept for failed commands. */
  output: string;
}

interface PendingCommand {
  prompt: IMarker;
  input: { marker: IMarker; column: number } | null;
  output: IMarker | null;
}

interface TrackedCommand {
  prompt: IMarker;
  decoration: IDecoration | undefined;
}

interface CommandTrackerOptions {
  onCommandStart: () => void;
  onCommandEnd: (command: FinishedCommand) => void;
  onSelect: (command: FinishedCommand) => void;
}

export function isFailure(command: FinishedCommand): boolean {
  return command.exitCode !== 0;
}

function styleGutterMark(element: HTMLElement, command: FinishedCommand): void {
  const failed = isFailure(command);
  element.classList.add(
    "rounded-full",
    failed ? "bg-status-error" : "bg-status-success/60",
    ...(failed ? ["cursor-pointer"] : []),
  );
  // The bar sits in the gutter left of the first column.
  element.style.left = "-6px";
  element.style.width = "3px";
  element.title = failed
    ? `Exit code ${command.exitCode ?? "unknown"}. Click for actions.`
    : "Exit code 0";
}

/** Follows OSC 133 marks to find each command, mark it in the gutter and jump between prompts. */
export class CommandTracker implements IDisposable {
  private readonly term: XTerm;
  private readonly options: CommandTrackerOptions;
  private readonly oscHandler: IDisposable;
  private pending: PendingCommand | null = null;
  private commands: TrackedCommand[] = [];
  private jumpLine: number | null = null;
  private jumpViewportY: number | null = null;

  constructor(term: XTerm, options: CommandTrackerOptions) {
    this.term = term;
    this.options = options;
    this.oscHandler = term.parser.registerOscHandler(OSC_SHELL_INTEGRATION, (data) => {
      this.handleMark(data);
      return true;
    });
  }

  dispose(): void {
    this.oscHandler.dispose();
    this.disposePending();
    for (const command of this.commands) {
      command.decoration?.dispose();
      command.prompt.dispose();
    }
    this.commands = [];
  }

  /** Scrolls to the previous or next command's prompt; past the last one it scrolls to the bottom. */
  jump(direction: "previous" | "next"): void {
    const buffer = this.term.buffer.active;
    if (buffer.type !== "normal") return;
    if (this.jumpViewportY !== buffer.viewportY) this.jumpLine = null;

    const atBottom = buffer.viewportY >= buffer.baseY;
    const anchor =
      this.jumpLine ??
      (direction === "previous" && atBottom ? Number.POSITIVE_INFINITY : buffer.viewportY);
    const lines = this.commands.map((command) => command.prompt.line).filter((line) => line >= 0);
    const target = findJumpTarget(lines, anchor, direction);

    if (target === null) {
      if (direction === "next") {
        this.term.scrollToBottom();
        this.jumpLine = null;
      }
      return;
    }
    this.term.scrollToLine(target);
    this.jumpLine = target;
    this.jumpViewportY = buffer.viewportY;
  }

  private handleMark(data: string): void {
    const mark = parseShellMark(data);
    if (!mark) return;
    const buffer = this.term.buffer.active;
    if (buffer.type !== "normal") return;

    switch (mark.kind) {
      case "promptStart":
        this.disposePending();
        this.pending = { prompt: this.term.registerMarker(0), input: null, output: null };
        return;
      case "inputStart":
        if (!this.pending || this.pending.output) return;
        this.pending.input?.marker.dispose();
        this.pending.input = { marker: this.term.registerMarker(0), column: buffer.cursorX };
        return;
      case "outputStart":
        if (!this.pending || this.pending.output) return;
        this.pending.output = this.term.registerMarker(0);
        this.options.onCommandStart();
        return;
      case "commandEnd":
        this.finish(mark.exitCode);
        return;
    }
  }

  private finish(exitCode: number | null): void {
    const pending = this.pending;
    if (!pending?.output) return;
    this.pending = null;

    const buffer = this.term.buffer.active;
    const { input, output, prompt } = pending;
    const command = input
      ? readCommandText(buffer, input.marker.line, input.column, output.line)
      : "";
    const text = readCommandOutput(buffer, output.line, buffer.baseY + buffer.cursorY);
    input?.marker.dispose();
    output.dispose();

    // Bash reports an empty Enter as a command with the previous exit code.
    if (!command && !text) {
      prompt.dispose();
      return;
    }
    const finished: FinishedCommand = { command, exitCode, output: "" };
    if (isFailure(finished)) finished.output = text;
    this.track(prompt, finished);
    this.options.onCommandEnd(finished);
  }

  private track(prompt: IMarker, command: FinishedCommand): void {
    const decoration = this.term.registerDecoration({
      marker: prompt,
      x: 0,
      width: 1,
      layer: "top",
    });
    const tracked: TrackedCommand = { prompt, decoration };
    decoration?.onRender((element) => {
      styleGutterMark(element, command);
      if (isFailure(command)) element.onclick = () => this.options.onSelect(command);
    });
    prompt.onDispose(() => {
      decoration?.dispose();
      this.commands = this.commands.filter((item) => item !== tracked);
    });
    this.commands.push(tracked);
  }

  private disposePending(): void {
    if (!this.pending) return;
    this.pending.input?.marker.dispose();
    this.pending.output?.dispose();
    this.pending.prompt.dispose();
    this.pending = null;
  }
}
