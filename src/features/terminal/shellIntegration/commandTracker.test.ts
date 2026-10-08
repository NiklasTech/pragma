import type { Terminal as XTerm } from "@xterm/xterm";
import { describe, expect, it, vi } from "vite-plus/test";

import { CommandTracker, type FinishedCommand } from "./commandTracker";

class FakeMarker {
  isDisposed = false;
  private listeners: Array<() => void> = [];

  constructor(public line: number) {}

  onDispose(listener: () => void) {
    this.listeners.push(listener);
    return { dispose: () => {} };
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.line = -1;
    for (const listener of this.listeners) listener();
  }
}

/** Just enough of xterm for the tracker: rows of text, a cursor, markers and an OSC hook. */
class FakeTerminal {
  rows: string[] = [""];
  viewportY = 0;
  baseY = 0;
  markers: FakeMarker[] = [];
  decorations = 0;
  private osc: ((data: string) => boolean) | null = null;

  parser = {
    registerOscHandler: (_ident: number, callback: (data: string) => boolean) => {
      this.osc = callback;
      return { dispose: () => (this.osc = null) };
    },
  };

  buffer = {
    active: {
      type: "normal",
      getLine: (index: number) => {
        const text = this.rows[index];
        if (text === undefined) return undefined;
        return {
          isWrapped: false,
          translateToString: (_trim?: boolean, start = 0) => text.slice(start).trimEnd(),
        };
      },
      cursorX: 0,
      cursorY: 0,
      viewportY: 0,
      baseY: 0,
    },
  };

  constructor() {
    Object.defineProperties(this.buffer.active, {
      cursorX: { get: () => this.rows[this.rows.length - 1].length },
      cursorY: { get: () => this.rows.length - 1 - this.baseY },
      viewportY: { get: () => this.viewportY },
      baseY: { get: () => this.baseY },
    });
  }

  registerMarker() {
    const marker = new FakeMarker(this.rows.length - 1);
    this.markers.push(marker);
    return marker;
  }

  registerDecoration() {
    this.decorations += 1;
    return { onRender: () => ({ dispose: () => {} }), dispose: () => {} };
  }

  scrollToLine(line: number) {
    this.viewportY = Math.min(line, this.baseY);
  }

  scrollToBottom() {
    this.viewportY = this.baseY;
  }

  write(text: string) {
    const [first, ...rest] = text.split("\n");
    this.rows[this.rows.length - 1] += first;
    this.rows.push(...rest);
  }

  mark(data: string) {
    this.osc?.(data);
  }

  run(command: string, output: string, exitCode: number) {
    this.mark("A");
    this.write("$ ");
    this.mark("B");
    this.write(`${command}\n`);
    this.mark("C");
    this.write(output);
    this.mark(`D;${exitCode}`);
  }

  asXTerm(): XTerm {
    return this as unknown as XTerm;
  }
}

function track(terminal: FakeTerminal) {
  const ended: FinishedCommand[] = [];
  const onCommandStart = vi.fn();
  const tracker = new CommandTracker(terminal.asXTerm(), {
    onCommandStart,
    onCommandEnd: (command) => ended.push(command),
    onSelect: vi.fn(),
  });
  return { tracker, ended, onCommandStart };
}

describe("CommandTracker", () => {
  it("reports each command with its exit code and keeps output only for failures", () => {
    const terminal = new FakeTerminal();
    const { ended, onCommandStart } = track(terminal);

    terminal.run("echo hi", "hi\n", 0);
    terminal.run("npm test", "1 test failed\n", 1);

    expect(onCommandStart).toHaveBeenCalledTimes(2);
    expect(ended).toEqual([
      { command: "echo hi", exitCode: 0, output: "" },
      { command: "npm test", exitCode: 1, output: "1 test failed" },
    ]);
    expect(terminal.decorations).toBe(2);
  });

  it("ignores prompts without a command and empty Enters", () => {
    const terminal = new FakeTerminal();
    const { ended } = track(terminal);

    terminal.mark("D;0");
    terminal.mark("A");
    terminal.write("$ ");
    terminal.mark("B");
    terminal.write("\n");
    terminal.mark("D;0");
    terminal.run("", "", 1);

    expect(ended).toEqual([]);
    expect(terminal.decorations).toBe(0);
  });

  it("stops tracking once disposed", () => {
    const terminal = new FakeTerminal();
    const { tracker, ended } = track(terminal);
    terminal.run("true", "", 0);
    terminal.mark("A");

    tracker.dispose();
    terminal.run("false", "", 1);

    expect(ended).toEqual([{ command: "true", exitCode: 0, output: "" }]);
    expect(terminal.markers).toHaveLength(4);
    expect(terminal.markers.every((marker) => marker.isDisposed)).toBe(true);
  });

  it("jumps between prompts and back to the bottom", () => {
    const terminal = new FakeTerminal();
    const { tracker } = track(terminal);
    terminal.run("one", "1\n", 0);
    terminal.run("two", "2\n", 0);
    terminal.run("three", "3\n", 0);
    terminal.mark("A");
    terminal.write("$ ");
    terminal.baseY = 5;
    terminal.viewportY = 5;

    tracker.jump("previous");
    expect(terminal.viewportY).toBe(4);
    tracker.jump("previous");
    expect(terminal.viewportY).toBe(2);
    tracker.jump("previous");
    expect(terminal.viewportY).toBe(0);
    tracker.jump("previous");
    expect(terminal.viewportY).toBe(0);
    tracker.jump("next");
    expect(terminal.viewportY).toBe(2);
    tracker.jump("next");
    tracker.jump("next");
    expect(terminal.viewportY).toBe(5);
  });
});
